-- Un restaurante tiene varias cartas y ahora cada una tiene su página y su QR,
-- pero el tablero seguía contando `menu_view` a nivel de ficha: el dueño podía
-- ver que el QR trae gente y no cuál de los códigos —el de la barra o el de la
-- mesa— es el que la trae.
--
-- `menu_id` guarda la carta en la que ocurrió el evento. Es nulo en todo lo
-- demás: la ficha, el teléfono, cómo llegar y la página con todas las cartas no
-- pasan por ningún menú en particular, y forzarles uno sería inventar el dato.
alter table public.restaurant_events
  add column if not exists menu_id uuid references public.menus (id) on delete set null;

comment on column public.restaurant_events.menu_id is
  'La carta en la que ocurrió el evento, cuando fue en la página de una sola. Nulo en el resto.';

-- El índice que evita contar diez veces a quien recarga tenía que crecer con
-- la columna: sin ella, mirar la carta de bebidas y la de comida en la misma
-- hora era un solo `menu_view` y la segunda se perdía.
--
-- El `coalesce` no es un adorno: en un índice único Postgres considera
-- distintos a dos NULL, así que con la columna a secas los eventos sin carta
-- —que son casi todos— dejarían de deduplicarse.
drop index if exists public.restaurant_events_sin_repetir;
create unique index restaurant_events_sin_repetir
  on public.restaurant_events (
    restaurant_id,
    visitor,
    event,
    hora,
    coalesce(menu_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index restaurant_events_carta_idx
  on public.restaurant_events (restaurant_id, menu_id, event, created_at desc)
  where menu_id is not null;

-- Que la carta sea de esa ficha y esté visible se comprueba en la base y no
-- solo en la ruta que recibe los eventos: la política es lo único que sigue
-- puesto si mañana alguien escribe contra PostgREST directamente. Va en una
-- función `security definer` por lo mismo que `restaurant_is_public`: dentro
-- de una política, una subconsulta a `menus` la filtraría la RLS de quien
-- escribe.
create or replace function public.menu_es_de_la_ficha(menu uuid, ficha uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.menus m
    where m.id = menu and m.restaurant_id = ficha and m.is_visible
  );
$$;

revoke all on function public.menu_es_de_la_ficha(uuid, uuid) from public;
grant execute on function public.menu_es_de_la_ficha(uuid, uuid) to anon, authenticated;

drop policy if exists restaurant_events_insert_publicos on public.restaurant_events;
create policy restaurant_events_insert_publicos on public.restaurant_events
  for insert to anon, authenticated
  with check (
    public.restaurant_is_public(restaurant_id)
    and (menu_id is null or public.menu_es_de_la_ficha(menu_id, restaurant_id))
  );

-- Misma función del tablero, ahora con `cartas`: cuánto se vio y cuánto se
-- escaneó cada una en el periodo. Se devuelve la lista completa de cartas del
-- restaurante, incluidas las que van en cero, porque un cero es justo lo que el
-- dueño necesita ver para saber que el QR de la barra no lo escanea nadie.
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
    select e.event, e.source, e.city, e.lat, e.lng, e.menu_id,
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
  -- cartas que nadie abrió, que son las que hay que arreglar. Se queda fuera
  -- la carta oculta sin un solo evento; la que se ocultó a media semana
  -- conserva lo que ya midió.
  por_carta as (
    select e.menu_id,
           count(*) filter (where e.event = 'menu_view')::bigint as vistas,
           count(*) filter (where e.event = 'qr_scan')::bigint as escaneos
    from actuales e
    where e.menu_id is not null
    group by e.menu_id
  ),
  cartas as (
    -- `position` se renombra: a secas, en un ORDER BY, Postgres lo lee como la
    -- función position() y no como la columna.
    select m.id,
           m.name,
           m.position as orden,
           coalesce(c.vistas, 0) as vistas,
           coalesce(c.escaneos, 0) as escaneos
    from public.menus m
    left join por_carta c on c.menu_id = m.id
    where m.restaurant_id = rid
      and (m.is_visible or c.menu_id is not null)
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
        order by vistas desc, escaneos desc, orden, name) from cartas), '[]'::jsonb)
  ) into salida;

  return salida;
end;
$$;

comment on function public.restaurant_metrics(uuid, text) is
  'Métricas del tablero para un restaurante y un periodo, en la zona horaria del local. Incluye el desglose por carta.';
