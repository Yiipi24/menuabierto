-- Busqueda unica para la pantalla de comensal. Se resuelve en la base y no en
-- la app porque ordenar por distancia exige el indice GiST: traer todo a
-- JavaScript y medir ahi no escala mas alla de un pueblo.
create function public.search_restaurants(
  lat double precision default null,
  lng double precision default null,
  radius_m integer default 5000,
  cuisine_slugs text[] default null,
  max_price_level smallint default null,
  min_rating numeric default null,
  open_now boolean default false,
  search_text text default null,
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
  neighborhood text,
  rating_avg numeric,
  rating_count integer,
  is_claimed boolean,
  plan public.plan_tier,
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
  )
  select
    r.id,
    r.slug,
    r.name,
    r.summary,
    r.price_level,
    r.city,
    r.neighborhood,
    r.rating_avg,
    r.rating_count,
    r.owner_id is not null as is_claimed,
    r.plan,
    case when o.punto is null then null
         else st_distance(r.location, o.punto) end as distance_m
  from public.restaurants r
  cross join origen o
  where r.status = 'publicado'
    and (o.punto is null or (r.location is not null
         and st_dwithin(r.location, o.punto, radius_m)))
    and (max_price_level is null or r.price_level <= max_price_level)
    and (min_rating is null or r.rating_avg >= min_rating)
    and (search_text is null or btrim(search_text) = ''
         or r.name ilike '%' || btrim(search_text) || '%')
    and (cuisine_slugs is null or exists (
      select 1
      from public.restaurant_cuisines rc
      join public.cuisines c on c.id = rc.cuisine_id
      where rc.restaurant_id = r.id and c.slug = any (cuisine_slugs)
    ))
    and (not open_now or exists (
      select 1
      from public.restaurant_hours h
      where h.restaurant_id = r.id
        and h.weekday = extract(dow from now())::smallint
        and case
              -- Tramo normal dentro del mismo dia.
              when h.closes > h.opens
                then now()::time between h.opens and h.closes
              -- Tramo que cruza la medianoche.
              else now()::time >= h.opens or now()::time <= h.closes
            end
    ))
  -- Premium primero, luego lo mas cercano, luego lo mejor calificado. Sin
  -- ubicacion la distancia es nula y el orden cae en la calificacion.
  order by
    (r.plan = 'premium' and (r.premium_until is null or r.premium_until > now())) desc,
    distance_m asc nulls last,
    r.rating_avg desc nulls last,
    r.rating_count desc
  limit least(coalesce(result_limit, 20), 100)
  offset greatest(coalesce(result_offset, 0), 0);
$$;

comment on function public.search_restaurants is
  'Busqueda del directorio. security invoker a proposito: respeta la RLS de restaurants, asi que solo devuelve fichas publicadas.';
