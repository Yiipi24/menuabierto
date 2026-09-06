-- La portada crece en dos direcciones y la búsqueda tiene que acompañarla.
--
-- La primera es el filtro de servicios: quien busca con carriola quiere ver
-- solo los que tienen área de niños, y quien no piensa salir de casa, solo los
-- que llevan a domicilio. Los servicios ya viven en `restaurants.amenities`,
-- así que filtrar es contener el arreglo; lo que faltaba era la puerta para
-- pedirlo.
--
-- La segunda es el mapa: hasta ahora la función devolvía la distancia pero no
-- las coordenadas, y con distancia sola no se pinta un punto. Salen ya
-- separadas en lat/lng porque `location` es geography y cruzarla por PostgREST
-- llegaría como WKB, que el navegador tendría que volver a leer.
--
-- Cambia el tipo de retorno, así que no basta `create or replace`: hay que
-- soltar la anterior por su firma. Los dos parámetros nuevos llevan default
-- null, de modo que el código desplegado hoy —que llama con argumentos
-- nombrados y no los manda— sigue funcionando igual mientras el despliegue
-- alcanza a la migración.
drop function if exists public.search_restaurants(
  double precision, double precision, integer, text[], smallint, numeric,
  boolean, text, text, text, integer, integer
);

create function public.search_restaurants(
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
      r.amenities,
      public.restaurant_abierto(r.id) as is_open_now,
      case when o.punto is null then null
           else st_distance(r.location, o.punto) end as distance_m,
      -- Las coordenadas solo salen de una ficha publicada, que es publica por
      -- definicion: es la misma direccion que ya se enseña en la ficha.
      case when r.location is null then null
           else st_y(r.location::geometry) end as lat,
      case when r.location is null then null
           else st_x(r.location::geometry) end as lng,
      -- Con el plan intermedio, destacar es cosa de los dos planes de paga y
      -- ya no solo de premium.
      r.plan <> 'basico'
        and (r.premium_until is null or r.premium_until > now()) as es_premium
    from public.restaurants r
    cross join origen o
    where r.status = 'publicado'
      -- Sin ubicacion no se filtra por radio: quien no la comparte debe ver
      -- igual el directorio, acotado por lo que escriba.
      and (o.punto is null
           -- Una ficha sin coordenadas no puede quedar fuera del radio: no
           -- sabemos donde esta, y esconderla es afirmar que esta lejos.
           -- Sale igual, pero al final, porque su distancia es nula. Cuando
           -- la mayoria tenga coordenadas conviene volver a apretar esto.
           or r.location is null
           -- Si ademas escribio un lugar, manda el texto. Buscar "Escobedo"
           -- desde el centro de Monterrey tiene que traer Escobedo, no el
           -- vacio que dejaba cruzar el radio con el nombre.
           --
           -- Se recorta igual que el filtro de mas abajo, con las comas
           -- incluidas: si aqui ", " contara como lugar y alli no, apagaria el
           -- radio sin poner ningun filtro en su lugar, y "Cerca de mi"
           -- devolveria el directorio entero.
           or coalesce(btrim(place_text, ' ,'), '') <> ''
           or st_dwithin(r.location, o.punto, radius_m))
      and (max_price_level is null or r.price_level <= max_price_level)
      and (min_rating is null or r.rating_avg >= min_rating)
      -- Los servicios se piden juntos, no sueltos: quien marca "domicilio" y
      -- "wifi" quiere los dos, no cualquiera de los dos.
      and (amenity_slugs is null or array_length(amenity_slugs, 1) is null
           or r.amenities @> amenity_slugs)
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
           -- Solo los menus visibles: encontrar un restaurante por un platillo
           -- de una carta que su dueno tiene guardada manda a la ficha a
           -- buscar algo que no esta.
           or exists (
             select 1
             from public.menu_items mi
             join public.menus m on m.id = mi.menu_id
             where mi.restaurant_id = r.id
               and m.is_visible
               and unaccent(mi.name) ilike '%' || unaccent(btrim(search_text)) || '%'
           ))
      -- La gente escribe el lugar como lo diria en voz alta: "Escobedo,
      -- Nuevo Leon". Como una sola cadena eso no casa con ninguna ficha,
      -- porque neighborhood, city y state no vienen en ese orden ni estan
      -- todos llenos. Cada parte separada por coma se prueba por su cuenta y
      -- basta con que una acierte.
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
  'Busqueda del directorio. security invoker a proposito: respeta la RLS de restaurants, asi que solo devuelve fichas publicadas. Una ficha sin coordenadas nunca la esconde el radio, y un lugar escrito manda sobre el. Los servicios pedidos se exigen todos, y lat/lng salen para el mapa de resultados.';
