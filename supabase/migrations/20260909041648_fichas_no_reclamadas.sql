-- Fichas no reclamadas: resolver el arranque en frio.
--
-- Un buscador sin restaurantes no sirve, y ningun dueno publica donde no hay
-- comensales. La tabla ya sabia distinguir una ficha cargada por nosotros de
-- una reclamada (owner_id nulo), y /reclamar ya existia; lo que faltaba era el
-- inventario y las piezas para sembrarlo sin duplicar ni inventar.

-- 1. De donde salio cada ficha. Solo las sembradas lo llevan: una ficha que
--    dio de alta su dueno no tiene fuente externa. El indice unico es lo que
--    hace idempotente al script de importacion: correrlo dos veces no crea
--    dos fichas del mismo registro del DENUE.
alter table public.restaurants
  add column source text check (source in ('denue')),
  add column source_id text,
  add constraint restaurants_source_coherente
    check ((source is null) = (source_id is null));

comment on column public.restaurants.source is
  'Fuente publica de la que se sembro la ficha (denue = INEGI). Nulo = la dio de alta su dueno.';
comment on column public.restaurants.source_id is
  'Identificador del registro en la fuente. Con source forma la llave que evita importar dos veces.';

create unique index restaurants_source_idx
  on public.restaurants (source, source_id)
  where source is not null;

-- 2. Duplicados por nombre y cercania. El DENUE trae el mismo local dos veces
--    con razones sociales distintas, y un dueno pudo haber dado de alta el
--    suyo antes de que lo sembraramos: en los dos casos gana la ficha que ya
--    esta. Se compara el nombre sin acentos con trigramas (pg_trgm) y a menos
--    de un radio corto; devuelve la ficha que choca, o nulo.
create function public.ficha_duplicada(
  p_nombre text,
  p_lat double precision,
  p_lng double precision,
  p_radio_m integer default 150
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from public.restaurants r
  where r.location is not null
    and p_lat is not null and p_lng is not null
    and st_dwithin(
      r.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      coalesce(p_radio_m, 150)
    )
    and similarity(unaccent(lower(r.name)), unaccent(lower(coalesce(p_nombre, '')))) > 0.55
  order by st_distance(r.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  limit 1;
$$;

revoke execute on function public.ficha_duplicada(text, double precision, double precision, integer)
  from anon, authenticated, public;

-- 3. Resolver un reclamo. Es security definer y solo lo ejecuta la llave de
--    servicio: aprobar es asignar owner_id, y eso no puede hacerlo ni el que
--    reclama ni cualquier otro autenticado. Aprobar uno rechaza los demas
--    pendientes de la misma ficha: un restaurante tiene un dueno.
create function public.aprobar_reclamo(p_claim uuid, p_resolved_by uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.restaurant_claims%rowtype;
begin
  select * into c
  from public.restaurant_claims
  where id = p_claim and status = 'pendiente'
  for update;
  if not found then
    raise exception 'reclamo_no_pendiente' using errcode = 'no_data_found';
  end if;

  update public.restaurants
  set owner_id = c.claimant_id, claimed_at = now()
  where id = c.restaurant_id and owner_id is null;
  if not found then
    raise exception 'ficha_ya_reclamada' using errcode = 'unique_violation';
  end if;

  update public.restaurant_claims
  set status = 'aprobada', resolved_at = now(), resolved_by = p_resolved_by
  where id = p_claim;

  update public.restaurant_claims
  set status = 'rechazada', resolved_at = now(), resolved_by = p_resolved_by
  where restaurant_id = c.restaurant_id and status = 'pendiente' and id <> p_claim;
end;
$$;

create function public.rechazar_reclamo(p_claim uuid, p_resolved_by uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.restaurant_claims
  set status = 'rechazada', resolved_at = now(), resolved_by = p_resolved_by
  where id = p_claim and status = 'pendiente';
  if not found then
    raise exception 'reclamo_no_pendiente' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.aprobar_reclamo(uuid, uuid) from anon, authenticated, public;
revoke execute on function public.rechazar_reclamo(uuid, uuid) from anon, authenticated, public;

-- 4. Solo se reclama lo que no tiene dueno. La politica de antes dejaba abrir
--    una solicitud sobre cualquier ficha; una ficha con dueno no se disputa
--    por aqui.
drop policy claims_insert_own on public.restaurant_claims;
create policy claims_insert_own on public.restaurant_claims
  for insert to authenticated
  with check (
    claimant_id = (select auth.uid())
    and status = 'pendiente'
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.owner_id is null
    )
  );

-- 5. En la busqueda, a igualdad de todo lo demas, una ficha que su dueno
--    mantiene va antes que una sembrada: tiene menu, fotos y horarios, que es
--    lo que quien busca vino a ver. Misma firma, solo cambia el orden.
create or replace function public.search_restaurants(
  lat double precision default null,
  lng double precision default null,
  radius_m integer default 5000,
  cuisine_slugs text[] default null,
  amenity_slugs text[] default null,
  max_price_level smallint default null,
  min_rating numeric default null,
  open_now boolean default false,
  search_text text default null,
  place_text text default null,
  sort_by text default 'relevancia',
  result_limit integer default 20,
  result_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  summary text,
  price_level smallint,
  city text,
  state text,
  neighborhood text,
  rating_avg numeric,
  rating_count integer,
  is_claimed boolean,
  plan public.plan_tier,
  cuisines text[],
  amenities text[],
  is_open_now boolean,
  distance_m double precision,
  lat double precision,
  lng double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  with origen as (
    select case
      when lat is null or lng is null then null
      else st_setsrid(st_makepoint(lng, lat), 4326)::geography
    end as punto
  ),
  base as (
    select
      r.id,
      r.slug,
      r.name,
      r.summary,
      r.price_level,
      r.city,
      r.state,
      r.neighborhood,
      r.rating_avg,
      r.rating_count,
      r.owner_id is not null as is_claimed,
      r.plan,
      coalesce((
        select array_agg(c.name order by c.name)
        from public.restaurant_cuisines rc
        join public.cuisines c on c.id = rc.cuisine_id
        where rc.restaurant_id = r.id
      ), '{}') as cuisines,
      r.amenities,
      public.restaurant_abierto(r.id) as is_open_now,
      case when o.punto is null then null
           else st_distance(r.location, o.punto) end as distance_m,
      case when r.location is null then null
           else st_y(r.location::geometry) end as lat,
      case when r.location is null then null
           else st_x(r.location::geometry) end as lng,
      r.plan <> 'basico'
        and (r.premium_until is null or r.premium_until > now()) as es_premium
    from public.restaurants r
    cross join origen o
    where r.status = 'publicado'
      and (o.punto is null
           or r.location is null
           or coalesce(btrim(place_text, ' ,'), '') <> ''
           or st_dwithin(r.location, o.punto, radius_m))
      and (max_price_level is null or r.price_level <= max_price_level)
      and (min_rating is null or r.rating_avg >= min_rating)
      and (amenity_slugs is null or array_length(amenity_slugs, 1) is null
           or r.amenities @> amenity_slugs)
      and (search_text is null or btrim(search_text) = ''
           or unaccent(r.name) ilike '%' || unaccent(btrim(search_text)) || '%'
           or unaccent(coalesce(r.summary, '')) ilike '%' || unaccent(btrim(search_text)) || '%'
           or exists (
             select 1
             from public.restaurant_cuisines rc
             join public.cuisines c on c.id = rc.cuisine_id
             where rc.restaurant_id = r.id
               and unaccent(c.name) ilike '%' || unaccent(btrim(search_text)) || '%'
           )
           or exists (
             select 1
             from public.menu_items mi
             join public.menus m on m.id = mi.menu_id
             where mi.restaurant_id = r.id
               and m.is_visible
               and unaccent(mi.name) ilike '%' || unaccent(btrim(search_text)) || '%'
           ))
      and (place_text is null or btrim(place_text, ' ,') = ''
           or exists (
             select 1
             from unnest(string_to_array(place_text, ',')) as parte
             where btrim(parte) <> ''
               and unaccent(
                     coalesce(r.neighborhood, '') || ' ' || r.city || ' ' ||
                     coalesce(r.state, '') || ' ' || coalesce(r.postal_code, '')
                   ) ilike '%' || unaccent(btrim(parte)) || '%'
           ))
      and (cuisine_slugs is null or exists (
        select 1
        from public.restaurant_cuisines rc
        join public.cuisines c on c.id = rc.cuisine_id
        where rc.restaurant_id = r.id and c.slug = any (cuisine_slugs)
      ))
      and (not open_now or public.restaurant_abierto(r.id))
  )
  select
    b.id, b.slug, b.name, b.summary, b.price_level, b.city, b.state,
    b.neighborhood, b.rating_avg, b.rating_count, b.is_claimed, b.plan,
    b.cuisines, b.amenities, b.is_open_now, b.distance_m, b.lat, b.lng
  from base b
  order by
    case when sort_by = 'cercanos' then b.distance_m end asc nulls last,
    case when sort_by = 'calificacion' then b.rating_avg end desc nulls last,
    (sort_by = 'relevancia' and b.es_premium) desc,
    -- Lo que mantiene un dueno antes que lo sembrado, salvo que la persona
    -- haya pedido otro orden.
    (sort_by = 'relevancia' and b.is_claimed) desc,
    b.distance_m asc nulls last,
    b.rating_avg desc nulls last,
    b.rating_count desc
  limit least(coalesce(result_limit, 20), 100)
  offset greatest(coalesce(result_offset, 0), 0);
$$;

comment on function public.search_restaurants is
  'Busqueda del directorio. security invoker a proposito: respeta la RLS de restaurants, asi que solo devuelve fichas publicadas. Una ficha sin coordenadas nunca la esconde el radio, y un lugar escrito manda sobre el. En relevancia, las reclamadas van antes que las sembradas del DENUE.';
