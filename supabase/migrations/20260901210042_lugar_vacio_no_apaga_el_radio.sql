-- Un lugar de puras comas apagaba el radio sin poner ningun filtro en su
-- lugar: la condicion del radio recortaba con btrim(place_text) y el filtro de
-- lugar de mas abajo con btrim(place_text, ' ,'), asi que "lugar=," con la
-- ubicacion puesta devolvia el directorio entero en vez de lo cercano. Las dos
-- recortan igual.
create or replace function public.search_restaurants(
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
      and (o.punto is null
           or r.location is null
           or coalesce(btrim(place_text, ' ,'), '') <> ''
           or st_dwithin(r.location, o.punto, radius_m))
      and (max_price_level is null or r.price_level <= max_price_level)
      and (min_rating is null or r.rating_avg >= min_rating)
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
             select 1 from public.menu_items mi
             where mi.restaurant_id = r.id
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
    b.cuisines, b.is_open_now, b.distance_m
  from base b
  order by
    case when sort_by = 'cercanos' then b.distance_m end asc nulls last,
    case when sort_by = 'calificacion' then b.rating_avg end desc nulls last,
    (sort_by = 'relevancia' and b.es_premium) desc,
    b.distance_m asc nulls last,
    b.rating_avg desc nulls last,
    b.rating_count desc
  limit least(coalesce(result_limit, 20), 100)
  offset greatest(coalesce(result_offset, 0), 0);
$$;
