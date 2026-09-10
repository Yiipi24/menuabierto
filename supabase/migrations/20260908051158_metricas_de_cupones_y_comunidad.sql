-- El tablero contaba lo que pasa en la ficha —visitas, teléfono, WhatsApp— y
-- nada de lo que pasa alrededor: cuánta gente sigue el restaurante, cuánta lo
-- guardó y si los cupones que reparte sirven de algo.
--
-- Las tres cosas se agregan a `restaurant_metrics` y no a una función aparte
-- porque el tablero pide un solo jsonb por periodo: dos funciones serían dos
-- viajes y dos periodos que se pueden desincronizar.
--
-- Seguidores y favoritos vienen con tres cifras cada uno: el total de hoy —que
-- es el número que el dueño quiere ver en grande— y cuántos entraron en este
-- periodo y en el anterior, que es lo que hace que la flecha suba o baje.
create or replace function public.restaurant_metrics(rid uuid, periodo text default '7d')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
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
    select e.event, e.source, e.city, e.lat, e.lng, e.menu_id, e.coupon_id,
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
  ),
  -- La lista sale de `menus` y no de los eventos: así aparecen también las
  -- cartas que nadie abrió, que son las que hay que arreglar.
  por_carta as (
    select e.menu_id,
           count(*) filter (where e.event = 'menu_view')::bigint as vistas,
           count(*) filter (where e.event = 'qr_scan')::bigint as escaneos
    from actuales e
    where e.menu_id is not null
    group by e.menu_id
  ),
  cartas as (
    select m.id,
           m.name,
           m.position as orden,
           coalesce(c.vistas, 0) as vistas,
           coalesce(c.escaneos, 0) as escaneos
    from public.menus m
    left join por_carta c on c.menu_id = m.id
    where m.restaurant_id = rid
      and (m.is_visible or c.menu_id is not null)
  ),
  -- Seguir y guardar no dejan evento: son filas en sus tablas, y lo que la
  -- tarjeta enseña es el total de hoy. El alta de cada fila da el "nuevos en
  -- el periodo" sin necesidad de medir nada aparte.
  seguidores as (
    select count(*)::bigint as total,
           count(*) filter (
             where created_at >= desde and created_at < hasta)::bigint as nuevos,
           count(*) filter (
             where created_at >= desde - largo and created_at < desde)::bigint as previos
    from public.restaurant_followers where restaurant_id = rid
  ),
  favoritos as (
    select count(*)::bigint as total,
           count(*) filter (
             where created_at >= desde and created_at < hasta)::bigint as nuevos,
           count(*) filter (
             where created_at >= desde - largo and created_at < desde)::bigint as previos
    from public.favorites where restaurant_id = rid
  ),
  -- Un cupón se mide de punta a punta: cuántos lo vieron, cuántos se llevaron
  -- el código y cuántos lo dijeron en la caja. La tercera cifra es la única
  -- que dice si la promoción vendió, y es la razón de que el cupón tenga
  -- código.
  cupon_eventos as (
    select coupon_id,
           count(*) filter (where event = 'coupon_view')::bigint as vistas,
           count(*) filter (where event = 'coupon_copy')::bigint as copias
    from actuales where coupon_id is not null group by coupon_id
  ),
  cupon_canjes as (
    select coupon_id, count(*)::bigint as canjes
    from public.coupon_redemptions
    where restaurant_id = rid and created_at >= desde and created_at < hasta
    group by coupon_id
  ),
  cupones as (
    select c.id, c.code, c.title, c.is_active,
           coalesce(e.vistas, 0) as vistas,
           coalesce(e.copias, 0) as copias,
           coalesce(k.canjes, 0) as canjes,
           c.created_at
    from public.coupons c
    left join cupon_eventos e on e.coupon_id = c.id
    left join cupon_canjes k on k.coupon_id = c.id
    where c.restaurant_id = rid
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
      select jsonb_object_agg(source, total) from fuentes), '{}'::jsonb),
    'cartas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'nombre', name, 'vistas', vistas, 'escaneos', escaneos)
        order by vistas desc, escaneos desc, orden, name) from cartas), '[]'::jsonb),
    'seguidores', (
      select jsonb_build_object('total', total, 'nuevos', nuevos, 'previos', previos)
      from seguidores),
    'favoritos', (
      select jsonb_build_object('total', total, 'nuevos', nuevos, 'previos', previos)
      from favoritos),
    'cupones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'codigo', code, 'titulo', title, 'activo', is_active,
        'vistas', vistas, 'copias', copias, 'canjes', canjes)
        order by canjes desc, vistas desc, created_at desc) from cupones), '[]'::jsonb)
  ) into salida;

  return salida;
end;
$fn$;
