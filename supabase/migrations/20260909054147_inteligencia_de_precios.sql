-- El foso: inteligencia de precios.
--
-- Guardamos precios estructurados por platillo, en centavos. Nadie mas tiene
-- ese dato: Google Maps guarda el menu como PDF o texto suelto. Hasta ahora no
-- se usaba para nada. Aqui entra lo que lo convierte en una razon para volver:
-- el historial de cambios (que no se conservaba), y las agregaciones para el
-- comensal (cuanto cuesta comer en una zona, quien vende que a cuanto) y para
-- el dueno (como esta su precio contra su zona y su cocina).
--
-- Todo lo del dueno es agregado y anonimo: nunca se senala a un restaurante
-- concreto en el panel de otro, y ninguna agregacion sale con menos de tres
-- restaurantes detras.

-- 1. El historial. Cada cambio de precio deja fila; la primera es el precio
--    con el que nacio el platillo. El dueno ve el suyo.
create table public.menu_item_price_history (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  price_cents integer,
  currency char(3) not null default 'MXN',
  changed_at timestamptz not null default now()
);

create index menu_item_price_history_item_idx
  on public.menu_item_price_history (menu_item_id, changed_at desc);
create index menu_item_price_history_restaurant_idx
  on public.menu_item_price_history (restaurant_id, changed_at desc);

alter table public.menu_item_price_history enable row level security;

create policy menu_item_price_history_select_own on public.menu_item_price_history
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create function public.registrar_precio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents then
    insert into public.menu_item_price_history (menu_item_id, restaurant_id, price_cents, currency)
    values (new.id, new.restaurant_id, new.price_cents, coalesce(new.currency, 'MXN'));
  end if;
  return new;
end;
$$;

revoke execute on function public.registrar_precio() from public, anon, authenticated;

create trigger menu_items_registrar_precio
  after insert or update of price_cents on public.menu_items
  for each row execute function public.registrar_precio();

-- Lo que ya existe entra como primer punto, con la fecha de su ultima
-- edicion: es lo mas cerca de "desde cuando vale esto" que se puede saber.
insert into public.menu_item_price_history (menu_item_id, restaurant_id, price_cents, currency, changed_at)
select id, restaurant_id, price_cents, coalesce(currency, 'MXN'), coalesce(updated_at, created_at, now())
from public.menu_items;

-- 2. Cuantos restaurantes hacen falta para publicar una agregacion. Con
--    menos, "la mediana de la colonia" es el precio de alguien con nombre.
create function public.minimo_para_agregar() returns integer
language sql immutable as $$ select 3 $$;

-- 3. Cuanto cuesta comer en una zona. Primero la mediana de cada restaurante
--    publicado con carta visible, y sobre esas medianas la de la zona y su
--    rango tipico. La zona se escribe como en el buscador ("Coyoacan",
--    "Escobedo, Nuevo Leon") y se compara igual.
create function public.precios_de_zona(p_lugar text)
returns table (
  restaurantes integer,
  platillos integer,
  mediana_cents integer,
  p25_cents integer,
  p75_cents integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with por_restaurante as (
    select
      r.id,
      percentile_cont(0.5) within group (order by mi.price_cents) as mediana,
      count(*) as n
    from public.menu_items mi
    join public.menus m on m.id = mi.menu_id and m.is_visible
    join public.restaurants r on r.id = mi.restaurant_id and r.status = 'publicado'
    where mi.price_cents is not null and mi.price_cents > 0 and mi.is_available
      and coalesce(btrim(p_lugar, ' ,'), '') <> ''
      and exists (
        select 1
        from unnest(string_to_array(p_lugar, ',')) as parte
        where btrim(parte) <> ''
          and unaccent(
                coalesce(r.neighborhood, '') || ' ' || r.city || ' ' ||
                coalesce(r.state, '') || ' ' || coalesce(r.postal_code, '')
              ) ilike '%' || unaccent(btrim(parte)) || '%'
      )
    group by r.id
  )
  select
    count(*)::integer,
    coalesce(sum(n), 0)::integer,
    case when count(*) >= public.minimo_para_agregar()
         then round(percentile_cont(0.5) within group (order by mediana))::integer end,
    case when count(*) >= public.minimo_para_agregar()
         then round(percentile_cont(0.25) within group (order by mediana))::integer end,
    case when count(*) >= public.minimo_para_agregar()
         then round(percentile_cont(0.75) within group (order by mediana))::integer end
  from por_restaurante;
$$;

grant execute on function public.precios_de_zona(text) to anon, authenticated;

-- 4. Quien vende que, y a cuanto, cerca de mi. Un platillo por restaurante
--    (el mas barato que coincide), con tope de precio opcional. Aqui si salen
--    los nombres: son los precios que cada carta ya publica.
create function public.platillos_cerca(
  p_termino text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radio_m integer default 5000,
  p_lugar text default null,
  p_max_cents integer default null,
  p_limite integer default 30
)
returns table (
  restaurant_id uuid,
  slug text,
  name text,
  neighborhood text,
  city text,
  menu_id uuid,
  item_id uuid,
  item_name text,
  price_cents integer,
  currency char(3),
  distance_m double precision,
  is_claimed boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with origen as (
    select case
      when p_lat is null or p_lng is null then null
      else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    end as punto
  ),
  coincidencias as (
    select distinct on (r.id)
      r.id as restaurant_id, r.slug, r.name, r.neighborhood, r.city,
      m.id as menu_id, mi.id as item_id, mi.name as item_name, mi.price_cents, mi.currency,
      case when o.punto is null or r.location is null then null
           else st_distance(r.location, o.punto) end as distance_m,
      r.owner_id is not null as is_claimed
    from public.menu_items mi
    join public.menus m on m.id = mi.menu_id and m.is_visible
    join public.restaurants r on r.id = mi.restaurant_id and r.status = 'publicado'
    cross join origen o
    where length(btrim(coalesce(p_termino, ''))) >= 2
      and unaccent(mi.name) ilike '%' || unaccent(btrim(p_termino)) || '%'
      and mi.price_cents is not null and mi.price_cents > 0 and mi.is_available
      and (p_max_cents is null or mi.price_cents <= p_max_cents)
      and (o.punto is null
           or coalesce(btrim(p_lugar, ' ,'), '') <> ''
           or (r.location is not null and st_dwithin(r.location, o.punto, coalesce(p_radio_m, 5000))))
      and (p_lugar is null or btrim(p_lugar, ' ,') = ''
           or exists (
             select 1
             from unnest(string_to_array(p_lugar, ',')) as parte
             where btrim(parte) <> ''
               and unaccent(
                     coalesce(r.neighborhood, '') || ' ' || r.city || ' ' ||
                     coalesce(r.state, '') || ' ' || coalesce(r.postal_code, '')
                   ) ilike '%' || unaccent(btrim(parte)) || '%'
           ))
    order by r.id, mi.price_cents asc
  )
  select * from coincidencias
  order by price_cents asc, distance_m asc nulls last, name
  limit least(greatest(coalesce(p_limite, 30), 1), 60);
$$;

grant execute on function public.platillos_cerca(text, double precision, double precision, integer, text, integer, integer)
  to anon, authenticated;

-- 5. La posicion de precio del dueno, dentro de Premium. Su mediana contra la
--    de su colonia (o su ciudad, si la colonia no llega al minimo) y contra la
--    de su cocina en la ciudad. Solo cifras agregadas: ni nombres ni conteos
--    tan chicos que delaten a alguien. Definer porque lee cartas ajenas para
--    agregarlas; comprueba que quien pregunta es el dueno y esta en Premium.
create function public.posicion_de_precio(rid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  yo record;
  mi_mediana numeric;
  mis_platillos integer;
  minimo integer := public.minimo_para_agregar();
  zona_n integer; zona_mediana numeric; zona_nivel text; zona_nombre text;
  cocina_n integer; cocina_mediana numeric; cocina_nombre text;
begin
  if not public.owns_restaurant(rid) then
    raise exception 'no_es_tuyo' using errcode = 'insufficient_privilege';
  end if;
  select * into yo from public.restaurants where id = rid;
  if yo.plan <> 'premium' or (yo.premium_until is not null and yo.premium_until <= now()) then
    raise exception 'solo_premium' using errcode = 'insufficient_privilege';
  end if;

  select percentile_cont(0.5) within group (order by mi.price_cents), count(*)
    into mi_mediana, mis_platillos
  from public.menu_items mi
  join public.menus m on m.id = mi.menu_id and m.is_visible
  where mi.restaurant_id = rid and mi.price_cents is not null and mi.price_cents > 0;

  -- La colonia; si no llega, la ciudad.
  zona_nivel := 'colonia';
  zona_nombre := yo.neighborhood;
  with medianas as (
    select percentile_cont(0.5) within group (order by mi.price_cents) as mediana
    from public.menu_items mi
    join public.menus m on m.id = mi.menu_id and m.is_visible
    join public.restaurants r on r.id = mi.restaurant_id and r.status = 'publicado'
    where r.id <> rid and mi.price_cents is not null and mi.price_cents > 0
      and yo.neighborhood is not null
      and unaccent(lower(coalesce(r.neighborhood, ''))) = unaccent(lower(yo.neighborhood))
      and unaccent(lower(r.city)) = unaccent(lower(yo.city))
    group by r.id
  )
  select count(*), percentile_cont(0.5) within group (order by mediana) into zona_n, zona_mediana from medianas;

  if coalesce(zona_n, 0) < minimo then
    zona_nivel := 'ciudad';
    zona_nombre := yo.city;
    with medianas as (
      select percentile_cont(0.5) within group (order by mi.price_cents) as mediana
      from public.menu_items mi
      join public.menus m on m.id = mi.menu_id and m.is_visible
      join public.restaurants r on r.id = mi.restaurant_id and r.status = 'publicado'
      where r.id <> rid and mi.price_cents is not null and mi.price_cents > 0
        and unaccent(lower(r.city)) = unaccent(lower(yo.city))
      group by r.id
    )
    select count(*), percentile_cont(0.5) within group (order by mediana) into zona_n, zona_mediana from medianas;
  end if;

  -- La cocina: los de la ciudad que comparten alguna categoria conmigo.
  select string_agg(c.name, ' · ' order by c.name) into cocina_nombre
  from public.restaurant_cuisines rc join public.cuisines c on c.id = rc.cuisine_id
  where rc.restaurant_id = rid;

  with medianas as (
    select percentile_cont(0.5) within group (order by mi.price_cents) as mediana
    from public.menu_items mi
    join public.menus m on m.id = mi.menu_id and m.is_visible
    join public.restaurants r on r.id = mi.restaurant_id and r.status = 'publicado'
    where r.id <> rid and mi.price_cents is not null and mi.price_cents > 0
      and unaccent(lower(r.city)) = unaccent(lower(yo.city))
      and exists (
        select 1 from public.restaurant_cuisines a
        join public.restaurant_cuisines b on b.cuisine_id = a.cuisine_id
        where a.restaurant_id = rid and b.restaurant_id = r.id
      )
    group by r.id
  )
  select count(*), percentile_cont(0.5) within group (order by mediana) into cocina_n, cocina_mediana from medianas;

  return jsonb_build_object(
    'mi_mediana', case when mis_platillos > 0 then round(mi_mediana) end,
    'mis_platillos', coalesce(mis_platillos, 0),
    'minimo', minimo,
    'zona', jsonb_build_object(
      'nivel', zona_nivel,
      'nombre', zona_nombre,
      'n', coalesce(zona_n, 0),
      'mediana', case when coalesce(zona_n, 0) >= minimo then round(zona_mediana) end
    ),
    'cocina', jsonb_build_object(
      'nombre', cocina_nombre,
      'n', coalesce(cocina_n, 0),
      'mediana', case when coalesce(cocina_n, 0) >= minimo then round(cocina_mediana) end
    )
  );
end;
$$;

revoke execute on function public.posicion_de_precio(uuid) from public, anon;
grant execute on function public.posicion_de_precio(uuid) to authenticated;

-- 6. /precios es una ruta fija nueva.
alter table public.restaurants drop constraint restaurants_slug_formato;
alter table public.restaurants add constraint restaurants_slug_formato check (
  slug ~ '^[a-z0-9]{1,60}(/[a-z0-9]{1,60})?$'
  and split_part(slug, '/', 1) !~ '^(api|auth|avisos|comida|entrar|explorar|favicon|icon|instalar|menu|novedades|panel|precios|public|q|r|reclamar|recuperar|registro|robots|sitemap|waitlist|_next)$'
  and split_part(slug, '/', 2) <> 'menu'
);
