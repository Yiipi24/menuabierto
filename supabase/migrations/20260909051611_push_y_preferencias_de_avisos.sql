-- PWA y avisos que de verdad llegan.
--
-- Historias de 24 horas, seguir y una bandeja de avisos son mecanicas de
-- aplicacion, pero los avisos no tenian por donde salir: nadie vuelve a
-- mirar la bandeja. Entra el push web: donde se guarda la suscripcion de cada
-- navegador, que tipos de aviso quiere cada persona, y la marca de que un
-- aviso ya salio por push para no mandarlo dos veces.

-- 1. Las suscripciones. Una por navegador (el endpoint es unico), varias por
--    persona. Se guardan tal como las da el navegador; la llave privada VAPID
--    vive en el servidor y nunca aqui.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2000),
  p256dh text not null,
  auth text not null,
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- Cada quien ve, registra y borra las suyas. Borrar es darse de baja: sin la
-- fila no hay a donde mandar nada, que es lo que "desactivar" tiene que
-- significar.
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (profile_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (profile_id = (select auth.uid()));

-- 2. Que avisos quiere cada persona por push. Un jsonb con una llave por
--    tipo; la llave que falta cuenta como encendida, asi que quien nunca toco
--    las preferencias recibe todo y quien apago algo lo apago de verdad.
alter table public.profiles
  add column push_prefs jsonb not null default '{}'::jsonb
  check (jsonb_typeof(push_prefs) = 'object');

comment on column public.profiles.push_prefs is
  'Por tipo de aviso (historia, resena, respuesta, insignia): false = no mandar por push. La llave ausente cuenta como true.';

-- 3. Los avisos ganan dos cosas: cuando salieron por push, y el tipo
--    "insignia" (ganar una al escribir una resena), que hasta ahora solo se
--    decia en pantalla al guardar.
alter table public.notifications
  add column pushed_at timestamptz,
  add column badge_slug text check (badge_slug is null or badge_slug ~ '^[a-z]{2,30}$'),
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('historia', 'resena', 'respuesta', 'insignia')),
  add constraint notifications_insignia_con_slug
    check ((kind = 'insignia') = (badge_slug is not null));

create index notifications_sin_push_idx
  on public.notifications (created_at)
  where pushed_at is null;

-- Una insignia se gana una vez.
create unique index notifications_sin_repetir_insignia
  on public.notifications (profile_id, badge_slug)
  where badge_slug is not null;

-- El aviso de insignia lo escribe la propia persona al guardar su resena:
-- es el unico tipo que se inserta desde la sesion y solo para uno mismo.
create policy notifications_insert_insignia_propia on public.notifications
  for insert to authenticated
  with check (profile_id = (select auth.uid()) and kind = 'insignia');

-- 4. La bandeja, con la insignia. Misma consulta, una columna mas.
drop function public.mis_avisos(integer);
create function public.mis_avisos(limite integer default 30)
returns table (
  id uuid,
  kind text,
  created_at timestamptz,
  read_at timestamptz,
  post_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_slug text,
  media_path text,
  vigente boolean,
  review_id uuid,
  review_rating smallint,
  review_author text,
  review_excerpt text,
  badge_slug text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    n.id,
    n.kind,
    n.created_at,
    n.read_at,
    n.post_id,
    n.restaurant_id,
    r.name,
    r.slug,
    p.media_path,
    (p.id is null or (p.publish_at <= now() and (p.expires_at is null or p.expires_at > now()))),
    n.review_id,
    v.rating,
    coalesce(nullif(btrim(pa.full_name), ''), 'Comensal'),
    left(coalesce(case when n.kind = 'respuesta' then v.owner_reply else v.body end, ''), 120),
    n.badge_slug
  from public.notifications n
  left join public.restaurants r on r.id = n.restaurant_id
  left join public.social_posts p on p.id = n.post_id
  left join public.reviews v on v.id = n.review_id
  left join public.profiles pa on pa.id = v.author_id
  where n.profile_id = (select auth.uid())
  order by n.created_at desc
  limit least(greatest(limite, 1), 50);
$$;

revoke execute on function public.mis_avisos(integer) from public, anon;
grant execute on function public.mis_avisos(integer) to authenticated;

-- 5. /instalar es una ruta fija nueva: un restaurante no puede quedarse con
--    ella. La lista de lib/slug.js dice lo mismo.
alter table public.restaurants drop constraint restaurants_slug_formato;
alter table public.restaurants add constraint restaurants_slug_formato check (
  slug ~ '^[a-z0-9]{1,60}(/[a-z0-9]{1,60})?$'
  and split_part(slug, '/', 1) !~ '^(api|auth|avisos|comida|entrar|explorar|favicon|icon|instalar|menu|novedades|panel|public|q|r|reclamar|recuperar|registro|robots|sitemap|waitlist|_next)$'
  and split_part(slug, '/', 2) <> 'menu'
);
