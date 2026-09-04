-- El panel enseñaba estimaciones porque no había nada que medir. Esta
-- migración crea lo que faltaba: una tabla de eventos y la función que el
-- panel usa para leerlos.
--
-- Un evento es "alguien hizo algo con esta ficha": la vio, escaneó el QR,
-- tocó el teléfono, pidió cómo llegar. No se guarda quién: `visitor` es un
-- identificador aleatorio que vive en una cookie del navegador y no se cruza
-- con ninguna cuenta. Tampoco se guarda la IP; la ciudad la pone el borde de
-- Vercel y se queda en ciudad, estado y país.

create type public.restaurant_event as enum (
  'restaurant_view',
  'qr_scan',
  'phone_click',
  'directions_click',
  'restaurant_save',
  'menu_view',
  'social_click',
  'website_click'
);

-- De dónde llegó la visita. Son las cuatro que el panel sabe pintar; si
-- mañana hay más, se agregan al enum sin tocar la tabla.
create type public.traffic_source as enum ('busqueda', 'qr', 'redes', 'directo');

create table public.restaurant_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  event public.restaurant_event not null,
  source public.traffic_source not null default 'directo',

  city text,
  region text,
  country char(2),

  -- Identificador anónimo del navegador. Sirve para no contar diez veces a
  -- quien recarga la página, y para nada más.
  visitor text not null check (length(visitor) between 8 and 64),

  created_at timestamptz not null default now(),

  -- La hora en UTC, materializada, porque el índice que evita los duplicados
  -- necesita una expresión inmutable.
  hora timestamp generated always as (date_trunc('hour', timezone('UTC', created_at))) stored
);

comment on table public.restaurant_events is
  'Eventos anónimos de las fichas. Alimentan el tablero del panel.';
comment on column public.restaurant_events.visitor is
  'Id aleatorio de la cookie del navegador. No identifica a nadie ni se cruza con auth.users.';

-- Un mismo navegador cuenta una vez por hora y por tipo de evento. Sin esto,
-- recargar la ficha cinco veces se vería como cinco visitas y el panel
-- mentiría hacia arriba.
create unique index restaurant_events_sin_repetir
  on public.restaurant_events (restaurant_id, visitor, event, hora);

create index restaurant_events_ficha_idx
  on public.restaurant_events (restaurant_id, created_at desc);

create index restaurant_events_ficha_tipo_idx
  on public.restaurant_events (restaurant_id, event, created_at desc);

alter table public.restaurant_events enable row level security;

-- Cualquiera que visite una ficha publicada puede registrar lo que hizo en
-- ella: es la única forma de medir a quien no tiene cuenta. La política no
-- deja escribir sobre fichas que no están publicadas, así que nadie puede
-- inflar borradores ajenos.
create policy restaurant_events_insert_publicos on public.restaurant_events
  for insert to anon, authenticated
  with check (public.restaurant_is_public(restaurant_id));

-- Leerlos es cosa del dueño, y aun así el panel entra por la función de
-- abajo. Nadie puede mirar el tráfico del restaurante de enfrente.
create policy restaurant_events_select_own on public.restaurant_events
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

-- Las métricas del panel, en una sola llamada.
--
-- El periodo se calcula aquí y no en el navegador porque "hoy" y "este mes"
-- solo significan algo en la hora del restaurante: para un local de Tijuana,
-- las 11 de la noche del lunes todavía son lunes.
--
-- Devuelve jsonb y no columnas porque son cinco cosas distintas (totales,
-- totales del periodo anterior, serie, lugares y fuentes) y hacerlas cinco
-- viajes de red para pintar una pantalla no tiene sentido.
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
  salida jsonb;
begin
  -- security definer salta la RLS, así que la autorización se comprueba a
  -- mano y antes que nada.
  if not public.owns_restaurant(rid) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select coalesce(r.timezone, 'America/Mexico_City') into zona
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
    select e.event, e.source, e.city,
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
           count(*)::bigint as total
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
      select jsonb_agg(jsonb_build_object('nombre', nombre, 'valor', total)
        order by total desc, nombre) from lugares), '[]'::jsonb),
    'fuentes', coalesce((
      select jsonb_object_agg(source, total) from fuentes), '{}'::jsonb)
  ) into salida;

  return salida;
end;
$$;

comment on function public.restaurant_metrics(uuid, text) is
  'Métricas del tablero para un restaurante y un periodo, en la zona horaria del local.';

revoke all on function public.restaurant_metrics(uuid, text) from public, anon;
grant execute on function public.restaurant_metrics(uuid, text) to authenticated;
