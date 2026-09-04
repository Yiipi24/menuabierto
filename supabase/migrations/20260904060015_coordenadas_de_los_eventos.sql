-- El ranking de ciudades ya decía desde dónde miran la ficha, pero un nombre
-- no se puede pintar en un mapa. Vercel manda la latitud y la longitud en la
-- misma petición en la que manda la ciudad, así que el punto sale gratis: no
-- hay que geocodificar nada después.
--
-- La precisión es la de la ciudad, no la de la calle: es el mismo dato que ya
-- guardábamos, escrito de otra forma.
alter table public.restaurant_events
  add column if not exists lat double precision,
  add column if not exists lng double precision;

comment on column public.restaurant_events.lat is
  'Latitud aproximada (nivel ciudad) que da el borde de Vercel. Nula si no la mandó.';

-- Misma función, ahora con coordenadas: cada lugar lleva su punto y la
-- respuesta trae el del propio restaurante, para que el mapa pueda centrarse
-- en el local y no en el promedio de quienes lo miran.
create or replace function public.restaurant_metrics(rid uuid, periodo text default '7d')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  zona text;
  hoy timestamp;
  desde_local timestamp;
  hasta_local timestamp;
  paso text;
  desde timestamptz;
  hasta timestamptz;
  largo interval;
  ficha_lat double precision;
  ficha_lng double precision;
  salida jsonb;
begin
  if not public.owns_restaurant(rid) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select coalesce(r.timezone, 'America/Mexico_City'),
         st_y(r.location::geometry),
         st_x(r.location::geometry)
    into zona, ficha_lat, ficha_lng
  from public.restaurants r where r.id = rid;

  hoy := date_trunc('day', timezone(zona, now()));

  case periodo
    when 'hoy' then
      desde_local := hoy;
      hasta_local := hoy + interval '1 day';
      paso := 'hour';
    when '30d' then
      desde_local := hoy - interval '29 days';
      hasta_local := hoy + interval '1 day';
      paso := 'day';
    when 'mes' then
      desde_local := date_trunc('month', hoy);
      hasta_local := hoy + interval '1 day';
      paso := 'day';
    when 'mes-anterior' then
      desde_local := date_trunc('month', hoy) - interval '1 month';
      hasta_local := date_trunc('month', hoy);
      paso := 'day';
    when '90d' then
      desde_local := hoy - interval '89 days';
      hasta_local := hoy + interval '1 day';
      paso := 'week';
    else
      periodo := '7d';
      desde_local := hoy - interval '6 days';
      hasta_local := hoy + interval '1 day';
      paso := 'day';
  end case;

  desde := timezone(zona, desde_local);
  hasta := timezone(zona, hasta_local);
  largo := hasta - desde;

  with actuales as (
    select e.event, e.source, e.city, e.lat, e.lng,
           date_trunc(paso, timezone(zona, e.created_at)) as bucket
    from public.restaurant_events e
    where e.restaurant_id = rid
      and e.created_at >= desde
      and e.created_at < hasta
  ),
  totales as (
    select event, count(*)::bigint as total from actuales group by event
  ),
  previos as (
    select e.event, count(*)::bigint as total
    from public.restaurant_events e
    where e.restaurant_id = rid
      and e.created_at >= desde - largo
      and e.created_at < desde
    group by e.event
  ),
  casillas as (
    select generate_series(
      date_trunc(paso, desde_local),
      date_trunc(paso, hasta_local - interval '1 microsecond'),
      ('1 ' || paso)::interval
    ) as bucket
  ),
  vistas as (
    select bucket, count(*)::bigint as total
    from actuales where event = 'restaurant_view' group by bucket
  ),
  serie as (
    select c.bucket, coalesce(v.total, 0) as total
    from casillas c left join vistas v on v.bucket = c.bucket
    order by c.bucket
  ),
  lugares as (
    -- El punto de cada ciudad es el promedio de las visitas que llegaron con
    -- coordenadas. Las que no traen punto siguen contando en el ranking; solo
    -- no se pueden pintar.
    select coalesce(nullif(btrim(city), ''), 'Sin ubicación') as nombre,
           count(*)::bigint as total,
           avg(lat) as lat,
           avg(lng) as lng
    from actuales where event = 'restaurant_view'
    group by 1 order by 2 desc, 1 limit 5
  ),
  fuentes as (
    select source, count(*)::bigint as total
    from actuales where event = 'restaurant_view' group by source
  )
  select jsonb_build_object(
    'periodo', periodo,
    'paso', paso,
    'zona', zona,
    'desde', desde,
    'hasta', hasta,
    'ficha', case
      when ficha_lat is null then null
      else jsonb_build_object('lat', ficha_lat, 'lng', ficha_lng)
    end,
    'totales', coalesce((select jsonb_object_agg(event, total) from totales), '{}'::jsonb),
    'previos', coalesce((select jsonb_object_agg(event, total) from previos), '{}'::jsonb),
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object(
        'inicio', to_char(bucket, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'dia', extract(isodow from bucket)::int,
        'hora', extract(hour from bucket)::int,
        'valor', total
      ) order by bucket) from serie), '[]'::jsonb),
    'lugares', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', nombre, 'valor', total, 'lat', lat, 'lng', lng)
        order by total desc, nombre) from lugares), '[]'::jsonb),
    'fuentes', coalesce((
      select jsonb_object_agg(source, total) from fuentes), '{}'::jsonb)
  ) into salida;

  return salida;
end;
$$;
