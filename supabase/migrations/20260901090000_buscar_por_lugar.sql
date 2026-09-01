-- La busqueda solo sabia filtrar por cercania, y quien no comparte su
-- ubicacion se quedaba sin forma de acotar: escribir "Escobedo" o "Villas del
-- Sol" no reducia nada. Se agrega place_text, que busca en colonia, ciudad y
-- estado, y un criterio de orden explicito para la pantalla de explorar.
--
-- Es drop + create y no create or replace porque cambia la lista de
-- argumentos y el tipo de retorno, que replace no admite.
drop function if exists public.search_restaurants(
  double precision, double precision, integer, text[], smallint, numeric,
  boolean, text, integer, integer
);

-- "Abierto ahora" se calculaba dentro de la busqueda y no habia forma de
-- pedirlo para una sola ficha. Extraerlo permite mostrarlo tambien en la
-- pagina publica del restaurante, con una sola definicion del horario.
create or replace function public.restaurant_abierto(rid uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $fn$
  select exists (
    select 1
    from public.restaurant_hours h
    where h.restaurant_id = rid
      and h.weekday = extract(dow from now())::smallint
      and case
            -- Tramo normal dentro del mismo dia.
            when h.closes > h.opens
              then now()::time between h.opens and h.closes
            -- Tramo que cruza la medianoche.
            else now()::time >= h.opens or now()::time <= h.closes
          end
  );
$fn$;

comment on function public.restaurant_abierto is
  'Si el restaurante tiene un tramo de horario vigente ahora mismo. Sin horarios cargados devuelve false.';

create function public.search_restaurants(
  lat double precision default null,
  lng double precision default null,
  radius_m integer default 5000,
  cuisine_slugs text[] default null,
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
  is_open_now boolean,
  distance_m double precision
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
  -- La distancia se calcula una vez aqui para poder ordenar por ella dentro
  -- de un CASE: en el ORDER BY de arriba, el alias de una columna de salida
  -- solo se acepta suelto, no dentro de una expresion.
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
      public.restaurant_abierto(r.id) as is_open_now,
      case when o.punto is null then null
           else st_distance(r.location, o.punto) end as distance_m,
      r.plan = 'premium'
        and (r.premium_until is null or r.premium_until > now()) as es_premium
    from public.restaurants r
    cross join origen o
    where r.status = 'publicado'
      -- Sin ubicacion no se filtra por radio: quien no la comparte debe ver
      -- igual el directorio, acotado por lo que escriba.
      and (o.punto is null or (r.location is not null
           and st_dwithin(r.location, o.punto, radius_m)))
      and (max_price_level is null or r.price_level <= max_price_level)
      and (min_rating is null or r.rating_avg >= min_rating)
      and (search_text is null or btrim(search_text) = ''
           or unaccent(r.name) ilike '%' || unaccent(btrim(search_text)) || '%'
           or unaccent(coalesce(r.summary, '')) ilike '%' || unaccent(btrim(search_text)) || '%'
           -- Buscar "tacos" tiene que encontrar a quien vende tacos aunque no
           -- lo lleve en el nombre: se busca tambien en categoria y en el menu.
           or exists (
             select 1
             from public.restaurant_cuisines rc
             join public.cuisines c on c.id = rc.cuisine_id
             where rc.restaurant_id = r.id
               and unaccent(c.name) ilike '%' || unaccent(btrim(search_text)) || '%'
           )
           or exists (
             select 1 from public.menu_items mi
             where mi.restaurant_id = r.id
               and unaccent(mi.name) ilike '%' || unaccent(btrim(search_text)) || '%'
           ))
      and (place_text is null or btrim(place_text) = ''
           or unaccent(
                coalesce(r.neighborhood, '') || ' ' || r.city || ' ' ||
                coalesce(r.state, '') || ' ' || coalesce(r.postal_code, '')
              ) ilike '%' || unaccent(btrim(place_text)) || '%')
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
    b.cuisines, b.is_open_now, b.distance_m
  from base b
  order by
    -- 'cercanos' respeta lo que pidio la persona y no antepone premium: si
    -- pide por distancia, un patrocinado a diez kilometros no va primero.
    case when sort_by = 'cercanos' then b.distance_m end asc nulls last,
    case when sort_by = 'calificacion' then b.rating_avg end desc nulls last,
    (sort_by = 'relevancia' and b.es_premium) desc,
    b.distance_m asc nulls last,
    b.rating_avg desc nulls last,
    b.rating_count desc
  limit least(coalesce(result_limit, 20), 100)
  offset greatest(coalesce(result_offset, 0), 0);
$$;

comment on function public.search_restaurants is
  'Busqueda del directorio. security invoker a proposito: respeta la RLS de restaurants, asi que solo devuelve fichas publicadas.';
