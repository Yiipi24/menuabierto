-- Historias y publicaciones: lo que el restaurante cuenta hoy.
--
-- Una ficha dice qué es un restaurante y una reseña dice cómo estuvo, pero
-- ninguna de las dos dice qué hay hoy: el brisket que acaba de salir del
-- ahumador, la promoción del martes, que hoy cierran temprano. Eso vivía en
-- Instagram, fuera del directorio, y el comensal que llegaba por aquí no lo
-- veía nunca.
--
-- Dos formas, porque son dos cosas distintas:
--   * `historia`   — dura 24 horas y desaparece sola. Es el "hoy" del local.
--   * `publicacion`— se queda hasta que el dueño la borra. Es lo que el
--                    restaurante quiere que se siga viendo la semana que viene.
--
-- El contenido y los restaurantes en los que sale van en tablas separadas
-- (`social_posts` y `social_post_restaurants`) porque un dueño con cuatro
-- sucursales publica la misma promoción en las cuatro: duplicar la fila sería
-- duplicar también sus likes, sus comentarios y su conteo de vistas, y la
-- misma foto acabaría con cuatro cifras distintas debajo.

-- ---------------------------------------------------------------------------
-- 1. El contenido
-- ---------------------------------------------------------------------------

create type public.social_kind as enum ('historia', 'publicacion');

comment on type public.social_kind is
  'Historia: caduca a las 24 horas. Publicación: vive hasta que la borren.';

create type public.social_media as enum ('imagen', 'video');

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.social_kind not null,
  -- El texto es opcional a propósito: una foto del plato ya dice bastante, y
  -- exigir un pie de foto es la clase de fricción que hace que no se publique.
  body text check (length(btrim(body)) <= 600),
  media_path text not null,
  media_mime text not null,
  media_kind public.social_media not null,
  -- Los conteos viven aquí y no se cuentan al leer. La ficha pinta el número
  -- debajo de cada publicación y el visor lo enseña sobre cada historia: con
  -- un `count(*)` por pieza, una ficha con diez publicaciones haría treinta
  -- consultas agregadas para dibujarse. Los mantienen triggers, que es lo
  -- único que no se puede desincronizar.
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nulo en las publicaciones y con fecha en las historias. Se guarda el
  -- instante y no un "hace 24 horas" calculado al leer para que la caducidad
  -- sea un dato del contenido: así el índice puede usarla y la historia
  -- desaparece a la misma hora para todo el mundo.
  expires_at timestamptz,
  constraint social_posts_caducidad check (
    (kind = 'historia' and expires_at is not null)
    or (kind = 'publicacion' and expires_at is null)
  )
);

comment on table public.social_posts is
  'Historias y publicaciones de los restaurantes. El dueño las escribe; los restaurantes donde salen están en social_post_restaurants.';

-- El feed del comensal y la lista de la ficha leen siempre por fecha
-- descendente, y las historias además filtran por caducidad.
create index social_posts_recientes_idx on public.social_posts (created_at desc);
create index social_posts_vigentes_idx on public.social_posts (expires_at)
  where expires_at is not null;
create index social_posts_author_idx on public.social_posts (author_id);

-- La caducidad la pone la base y no el navegador: una historia que dura 24
-- horas contadas desde el reloj de quien la publica duraría lo que ese reloj
-- diga. El trigger también impide cambiar de tipo al editar, que convertiría
-- una historia caducada en una publicación eterna.
create function public.social_post_defaults()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'historia' then
      new.expires_at := now() + interval '24 hours';
    else
      new.expires_at := null;
    end if;
  else
    new.kind := old.kind;
    new.expires_at := old.expires_at;
    new.created_at := old.created_at;
    new.updated_at := now();
    -- Los conteos los llevan sus propios triggers; un update de la fila no
    -- puede reescribirlos.
    new.likes_count := old.likes_count;
    new.comments_count := old.comments_count;
    new.views_count := old.views_count;
  end if;
  return new;
end;
$$;

create trigger social_posts_defaults
  before insert or update on public.social_posts
  for each row execute function public.social_post_defaults();

-- ---------------------------------------------------------------------------
-- 2. En qué restaurantes sale
-- ---------------------------------------------------------------------------

create table public.social_post_restaurants (
  post_id uuid not null references public.social_posts (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, restaurant_id)
);

comment on table public.social_post_restaurants is
  'En qué restaurantes sale cada historia o publicación. Un dueño con varias sucursales publica una vez en todas.';

-- La llave primaria sirve para ir del contenido a sus restaurantes; este
-- índice es el camino que de verdad se recorre: la ficha pide lo de un
-- restaurante y el feed lo de los que sigues.
create index social_post_restaurants_restaurante_idx
  on public.social_post_restaurants (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Quién ve qué
-- ---------------------------------------------------------------------------

-- security definer por lo mismo que `restaurant_is_public`: la política de una
-- tabla tiene que poder mirar otra sin quedar atrapada en la RLS de esa otra.
create function public.social_post_visible(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_posts p
    join public.social_post_restaurants pr on pr.post_id = p.id
    join public.restaurants r on r.id = pr.restaurant_id
    where p.id = target
      and r.status = 'publicado'
      and (p.expires_at is null or p.expires_at > now())
  );
$$;

comment on function public.social_post_visible(uuid) is
  'Responde si esta historia o publicación se puede ver: sale en alguna ficha publicada y todavía no caduca.';

create function public.social_post_mine(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.social_posts p
    where p.id = target and p.author_id = (select auth.uid())
  );
$$;

alter table public.social_posts enable row level security;
alter table public.social_post_restaurants enable row level security;

-- Lo publicado se ve; lo propio se ve siempre, también caducado, porque el
-- dueño tiene que poder consultar las estadísticas de la historia de ayer.
create policy social_posts_select_visible on public.social_posts
  for select to anon, authenticated
  using (public.social_post_visible(id) or author_id = (select auth.uid()));

-- Se crea la fila del contenido a nombre propio. Que salga en un restaurante
-- ajeno lo impide la política de `social_post_restaurants`: una publicación
-- sin restaurantes no la ve nadie, así que una fila suelta aquí no es una
-- fuga, es basura.
create policy social_posts_insert_own on public.social_posts
  for insert to authenticated
  with check (author_id = (select auth.uid()));

create policy social_posts_update_own on public.social_posts
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy social_posts_delete_own on public.social_posts
  for delete to authenticated
  using (author_id = (select auth.uid()));

-- El vínculo se lee cuando el contenido se puede leer.
create policy social_post_restaurants_select on public.social_post_restaurants
  for select to anon, authenticated
  using (public.social_post_visible(post_id) or public.social_post_mine(post_id));

-- Aquí es donde se decide de verdad quién publica en qué ficha: hace falta ser
-- el autor del contenido *y* el dueño del restaurante. Sin las dos, un dueño
-- podría colgar su promoción en la ficha del de enfrente.
create policy social_post_restaurants_insert on public.social_post_restaurants
  for insert to authenticated
  with check (
    public.social_post_mine(post_id)
    and public.owns_restaurant(restaurant_id)
  );

create policy social_post_restaurants_delete on public.social_post_restaurants
  for delete to authenticated
  using (public.social_post_mine(post_id) and public.owns_restaurant(restaurant_id));

-- ---------------------------------------------------------------------------
-- 4. Seguidores y su campana
-- ---------------------------------------------------------------------------

-- La preferencia de alertas va como columna y no como tabla aparte: es del
-- mismo grano —una persona y un restaurante— y separarla sería una tabla 1:1
-- que habría que unir en cada lectura para leer un booleano. Dejar de seguir
-- se lleva la preferencia por delante, que es justo lo que se espera.
create table public.restaurant_followers (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  notify_stories boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (profile_id, restaurant_id)
);

comment on table public.restaurant_followers is
  'A quién sigue cada comensal y si quiere aviso de sus historias. Solo la persona ve su lista; la ficha enseña el total agregado.';

create index restaurant_followers_restaurante_idx
  on public.restaurant_followers (restaurant_id);

-- Para el reparto de avisos: los seguidores de un restaurante con la campana
-- encendida, sin recorrer al resto.
create index restaurant_followers_con_alerta_idx
  on public.restaurant_followers (restaurant_id)
  where notify_stories;

alter table public.restaurant_followers enable row level security;

-- A quién sigues es tuyo, igual que los favoritos. El dueño no ve la lista de
-- nombres; ve el número, que es una columna agregada de `restaurants`.
create policy restaurant_followers_select_own on public.restaurant_followers
  for select to authenticated using (profile_id = (select auth.uid()));

create policy restaurant_followers_insert_own on public.restaurant_followers
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.restaurant_is_public(restaurant_id)
  );

create policy restaurant_followers_update_own on public.restaurant_followers
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy restaurant_followers_delete_own on public.restaurant_followers
  for delete to authenticated using (profile_id = (select auth.uid()));

-- El total sí es público: es lo que la ficha enseña junto al nombre. Va como
-- columna contada por trigger y no como `count(*)` sobre la tabla, que además
-- de costar una consulta obligaría a abrir la lista de seguidores a cualquiera.
alter table public.restaurants
  add column followers_count integer not null default 0;

comment on column public.restaurants.followers_count is
  'Cuántas personas siguen la ficha. Lo lleva un trigger sobre restaurant_followers.';

create function public.contar_seguidores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.restaurants
      set followers_count = followers_count + 1
      where id = new.restaurant_id;
  elsif tg_op = 'DELETE' then
    update public.restaurants
      set followers_count = greatest(followers_count - 1, 0)
      where id = old.restaurant_id;
  end if;
  return null;
end;
$$;

create trigger restaurant_followers_conteo
  after insert or delete on public.restaurant_followers
  for each row execute function public.contar_seguidores();

-- ---------------------------------------------------------------------------
-- 5. Me gusta, comentarios y vistas
-- ---------------------------------------------------------------------------

create table public.social_likes (
  post_id uuid not null references public.social_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

comment on table public.social_likes is
  'Me gusta. La llave compuesta hace imposible el doble like; el total va en social_posts.likes_count.';

create index social_likes_profile_idx on public.social_likes (profile_id);

create table public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.social_comments is
  'Comentarios de los comensales. Se leen por RPC porque el nombre del autor vive en profiles, que es privado.';

create index social_comments_post_idx on public.social_comments (post_id, created_at);
create index social_comments_author_idx on public.social_comments (author_id);

-- Las vistas son de las historias: es el número que el dueño busca al día
-- siguiente y el que el visor enseña arriba. Una fila por persona, así que
-- ver la misma historia tres veces sigue siendo una visualización.
create table public.social_story_views (
  post_id uuid not null references public.social_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

comment on table public.social_story_views is
  'Quién vio cada historia. Una fila por persona: recargar no infla el conteo.';

-- Los tres conteos con la misma función: la tabla que los dispara dice cuál
-- columna toca.
create function public.contar_social(columna text, pid uuid, delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format(
    'update public.social_posts set %I = greatest(%I + $1, 0) where id = $2',
    columna, columna
  ) using delta, pid;
end;
$$;

create function public.social_likes_conteo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.contar_social('likes_count', new.post_id, 1);
  else
    perform public.contar_social('likes_count', old.post_id, -1);
  end if;
  return null;
end;
$$;

create trigger social_likes_conteo
  after insert or delete on public.social_likes
  for each row execute function public.social_likes_conteo();

create function public.social_comments_conteo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.contar_social('comments_count', new.post_id, 1);
  else
    perform public.contar_social('comments_count', old.post_id, -1);
  end if;
  return null;
end;
$$;

create trigger social_comments_conteo
  after insert or delete on public.social_comments
  for each row execute function public.social_comments_conteo();

create function public.social_views_conteo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.contar_social('views_count', new.post_id, 1);
  return null;
end;
$$;

create trigger social_story_views_conteo
  after insert on public.social_story_views
  for each row execute function public.social_views_conteo();

alter table public.social_likes enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_story_views enable row level security;

-- Quién dio like es privado; el total ya está en el contenido. Cada quien lee
-- el suyo para que el corazón salga pintado al abrir la ficha.
create policy social_likes_select_own on public.social_likes
  for select to authenticated using (profile_id = (select auth.uid()));

create policy social_likes_insert_own on public.social_likes
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.social_post_visible(post_id)
  );

create policy social_likes_delete_own on public.social_likes
  for delete to authenticated using (profile_id = (select auth.uid()));

-- Los comentarios sí son públicos: son parte de lo que se lee debajo de la
-- publicación, igual que las reseñas.
create policy social_comments_select on public.social_comments
  for select to anon, authenticated
  using (public.social_post_visible(post_id) or public.social_post_mine(post_id));

create policy social_comments_insert_own on public.social_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.social_post_visible(post_id)
  );

create policy social_comments_update_own on public.social_comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

-- Lo borra quien lo escribió o el dueño del contenido: un restaurante tiene
-- que poder quitar un insulto de debajo de su propia foto.
create policy social_comments_delete_own on public.social_comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.social_post_mine(post_id));

create policy social_story_views_select_own on public.social_story_views
  for select to authenticated using (profile_id = (select auth.uid()));

create policy social_story_views_insert_own on public.social_story_views
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.social_post_visible(post_id)
  );

-- ---------------------------------------------------------------------------
-- 6. Avisos
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('historia')),
  post_id uuid references public.social_posts (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

comment on table public.notifications is
  'Avisos dentro de la aplicación. Hoy solo de historias nuevas de los restaurantes que sigues con la campana encendida.';

create index notifications_bandeja_idx
  on public.notifications (profile_id, created_at desc);

-- Sin leer, que es lo que pinta el punto rojo del menú.
create index notifications_sin_leer_idx
  on public.notifications (profile_id)
  where read_at is null;

-- Contra el aviso repetido. Una historia publicada a la vez en tres sucursales
-- que sigues es un aviso por sucursal —son tres restaurantes distintos— pero
-- nunca dos por la misma, aunque el reparto se ejecute otra vez.
create unique index notifications_sin_repetir
  on public.notifications (profile_id, kind, post_id, restaurant_id)
  where post_id is not null and restaurant_id is not null;

alter table public.notifications enable row level security;

-- La bandeja es de quien la recibe y de nadie más. No hay política de INSERT:
-- los avisos los reparte el trigger, que corre como definer. Que nadie pueda
-- escribir aquí desde el cliente es la garantía de que un aviso siempre
-- corresponde a algo que de verdad pasó.
create policy notifications_select_own on public.notifications
  for select to authenticated using (profile_id = (select auth.uid()));

-- Marcarlos como leídos es lo único que la persona cambia.
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy notifications_delete_own on public.notifications
  for delete to authenticated using (profile_id = (select auth.uid()));

-- El reparto va sobre `social_post_restaurants` y no sobre `social_posts`: el
-- aviso dice "JC Smoke House publicó una historia", así que hasta que el
-- contenido no tiene restaurante no hay nada que avisar. Al insertar la fila
-- del vínculo ya se sabe de qué ficha se habla.
create function public.avisar_historia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tipo public.social_kind;
  autor uuid;
begin
  select p.kind, p.author_id into tipo, autor
    from public.social_posts p where p.id = new.post_id;

  if tipo is distinct from 'historia' then
    return null;
  end if;

  -- Solo publicada: una historia de una ficha en borrador no le llega a nadie,
  -- igual que la ficha no se ve.
  if not exists (
    select 1 from public.restaurants r
    where r.id = new.restaurant_id and r.status = 'publicado'
  ) then
    return null;
  end if;

  insert into public.notifications (profile_id, kind, post_id, restaurant_id)
  select f.profile_id, 'historia', new.post_id, new.restaurant_id
    from public.restaurant_followers f
   where f.restaurant_id = new.restaurant_id
     and f.notify_stories
     -- El dueño no se avisa a sí mismo de lo que acaba de publicar.
     and f.profile_id <> autor
  on conflict do nothing;

  return null;
end;
$$;

create trigger social_post_restaurants_aviso
  after insert on public.social_post_restaurants
  for each row execute function public.avisar_historia();

-- ---------------------------------------------------------------------------
-- 7. Lecturas
-- ---------------------------------------------------------------------------
-- Todas por función y no por consulta directa: el nombre de quien comenta vive
-- en `profiles`, que es privado, y el feed cruza cinco tablas. Es el mismo
-- caso —y la misma solución— que `resenas_restaurante`.

-- Las historias vigentes de una ficha, con si ya las vi. `vista` es lo que
-- decide si el círculo sale con anillo de "nuevo" o apagado.
create function public.historias_restaurante(rid uuid)
returns table (
  id uuid,
  body text,
  media_path text,
  media_mime text,
  media_kind public.social_media,
  created_at timestamptz,
  expires_at timestamptz,
  views_count integer,
  vista boolean,
  es_mia boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.body,
    p.media_path,
    p.media_mime,
    p.media_kind,
    p.created_at,
    p.expires_at,
    p.views_count,
    exists (
      select 1 from public.social_story_views v
      where v.post_id = p.id and v.profile_id = (select auth.uid())
    ),
    p.author_id = (select auth.uid())
  from public.social_posts p
  join public.social_post_restaurants pr on pr.post_id = p.id
  where pr.restaurant_id = rid
    and p.kind = 'historia'
    and p.expires_at > now()
    and (
      public.restaurant_is_public(rid)
      or public.owns_restaurant(rid)
    )
  order by p.created_at asc;
$$;

comment on function public.historias_restaurante(uuid) is
  'Historias vigentes de una ficha, en el orden en que se publicaron, con si quien mira ya las vio.';

-- Las publicaciones de una ficha, paginadas. `antes` es el cursor: la fecha de
-- la última que ya se pintó. Por fecha y no por número de página porque
-- publicar mientras alguien baja movería todas las páginas un lugar.
create function public.publicaciones_restaurante(
  rid uuid,
  limite integer default 5,
  antes timestamptz default null
)
returns table (
  id uuid,
  body text,
  media_path text,
  media_mime text,
  media_kind public.social_media,
  created_at timestamptz,
  likes_count integer,
  comments_count integer,
  me_gusta boolean,
  es_mia boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.body,
    p.media_path,
    p.media_mime,
    p.media_kind,
    p.created_at,
    p.likes_count,
    p.comments_count,
    exists (
      select 1 from public.social_likes l
      where l.post_id = p.id and l.profile_id = (select auth.uid())
    ),
    p.author_id = (select auth.uid())
  from public.social_posts p
  join public.social_post_restaurants pr on pr.post_id = p.id
  where pr.restaurant_id = rid
    and p.kind = 'publicacion'
    and (antes is null or p.created_at < antes)
    and (
      public.restaurant_is_public(rid)
      or public.owns_restaurant(rid)
    )
  order by p.created_at desc
  limit least(greatest(limite, 1), 20);
$$;

comment on function public.publicaciones_restaurante(uuid, integer, timestamptz) is
  'Publicaciones de una ficha, de la más nueva a la más vieja. `antes` pagina por fecha.';

-- Los comentarios de una publicación, con el nombre de quien los escribió.
create function public.comentarios_publicacion(
  pid uuid,
  limite integer default 20,
  antes timestamptz default null
)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  puedo_borrar boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.body,
    c.created_at,
    c.author_id,
    coalesce(nullif(btrim(pr.full_name), ''), 'Comensal'),
    c.author_id = (select auth.uid()) or public.social_post_mine(c.post_id)
  from public.social_comments c
  join public.profiles pr on pr.id = c.author_id
  where c.post_id = pid
    and (public.social_post_visible(pid) or public.social_post_mine(pid))
    and (antes is null or c.created_at < antes)
  order by c.created_at desc
  limit least(greatest(limite, 1), 50);
$$;

comment on function public.comentarios_publicacion(uuid, integer, timestamptz) is
  'Comentarios de una publicación con el nombre de su autor. Por función porque profiles es privado.';

-- El feed del comensal: historias y publicaciones de lo que sigue, mezcladas y
-- de lo más nuevo a lo más viejo. Devuelve también el restaurante porque en el
-- feed cada pieza tiene que decir de quién es.
create function public.feed_seguidos(
  limite integer default 10,
  antes timestamptz default null
)
returns table (
  id uuid,
  kind public.social_kind,
  body text,
  media_path text,
  media_mime text,
  media_kind public.social_media,
  created_at timestamptz,
  expires_at timestamptz,
  likes_count integer,
  comments_count integer,
  views_count integer,
  me_gusta boolean,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_slug text,
  notify_stories boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.kind,
    p.body,
    p.media_path,
    p.media_mime,
    p.media_kind,
    p.created_at,
    p.expires_at,
    p.likes_count,
    p.comments_count,
    p.views_count,
    exists (
      select 1 from public.social_likes l
      where l.post_id = p.id and l.profile_id = (select auth.uid())
    ),
    r.id,
    r.name,
    r.slug,
    f.notify_stories
  from public.restaurant_followers f
  join public.restaurants r on r.id = f.restaurant_id and r.status = 'publicado'
  join public.social_post_restaurants pr on pr.restaurant_id = r.id
  join public.social_posts p on p.id = pr.post_id
  where f.profile_id = (select auth.uid())
    and (p.expires_at is null or p.expires_at > now())
    and (antes is null or p.created_at < antes)
  order by p.created_at desc
  limit least(greatest(limite, 1), 30);
$$;

comment on function public.feed_seguidos(integer, timestamptz) is
  'Lo que publicaron los restaurantes que sigue quien está firmado, de lo más nuevo a lo más viejo.';

-- Las estadísticas que el dueño ve junto a cada pieza en su panel. Van por
-- función porque cruzan el contenido con sus restaurantes y con `owns_restaurant`.
create function public.social_mias(
  limite integer default 30,
  antes timestamptz default null
)
returns table (
  id uuid,
  kind public.social_kind,
  body text,
  media_path text,
  media_mime text,
  media_kind public.social_media,
  created_at timestamptz,
  expires_at timestamptz,
  likes_count integer,
  comments_count integer,
  views_count integer,
  restaurantes jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.kind,
    p.body,
    p.media_path,
    p.media_mime,
    p.media_kind,
    p.created_at,
    p.expires_at,
    p.likes_count,
    p.comments_count,
    p.views_count,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug)
                 order by r.name
               )
        from public.social_post_restaurants pr
        join public.restaurants r on r.id = pr.restaurant_id
        where pr.post_id = p.id
      ),
      '[]'::jsonb
    )
  from public.social_posts p
  where p.author_id = (select auth.uid())
    and (antes is null or p.created_at < antes)
  order by p.created_at desc
  limit least(greatest(limite, 1), 50);
$$;

comment on function public.social_mias(integer, timestamptz) is
  'Lo que publicó quien está firmado, con sus restaurantes y sus números. Es la lista del panel.';

-- Los avisos de la bandeja, ya resueltos con el nombre y la dirección de la
-- ficha para que la lista no tenga que cruzarlos después.
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
  vigente boolean
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
    (p.expires_at is null or p.expires_at > now())
  from public.notifications n
  join public.restaurants r on r.id = n.restaurant_id
  left join public.social_posts p on p.id = n.post_id
  where n.profile_id = (select auth.uid())
  order by n.created_at desc
  limit least(greatest(limite, 1), 50);
$$;

comment on function public.mis_avisos(integer) is
  'La bandeja de quien está firmado, con el restaurante ya resuelto.';

-- Ninguna de estas funciones es para quien no ha entrado salvo las dos que
-- pinta la ficha pública, que es la que se abre sin sesión.
revoke execute on function public.historias_restaurante(uuid) from public;
revoke execute on function public.publicaciones_restaurante(uuid, integer, timestamptz) from public;
revoke execute on function public.comentarios_publicacion(uuid, integer, timestamptz) from public;
revoke execute on function public.feed_seguidos(integer, timestamptz) from public;
revoke execute on function public.social_mias(integer, timestamptz) from public;
revoke execute on function public.mis_avisos(integer) from public;
revoke execute on function public.contar_social(text, uuid, integer) from public;

grant execute on function public.historias_restaurante(uuid) to anon, authenticated;
grant execute on function public.publicaciones_restaurante(uuid, integer, timestamptz) to anon, authenticated;
grant execute on function public.comentarios_publicacion(uuid, integer, timestamptz) to anon, authenticated;
grant execute on function public.feed_seguidos(integer, timestamptz) to authenticated;
grant execute on function public.social_mias(integer, timestamptz) to authenticated;
grant execute on function public.mis_avisos(integer) to authenticated;

-- `social_post_visible` y `social_post_mine` las llaman las políticas, así que
-- tiene que poder ejecutarlas quien escribe: cualquiera que comente o dé like.
-- Es el mismo caso aceptado que `restaurant_is_public` y `menu_es_de_la_ficha`.
grant execute on function public.social_post_visible(uuid) to anon, authenticated;
grant execute on function public.social_post_mine(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. La barredora de historias
-- ---------------------------------------------------------------------------
-- Caducar y desaparecer no son lo mismo: las lecturas ya filtran por
-- `expires_at`, así que una historia vencida deja de verse en el instante
-- exacto aunque su fila siga ahí. Esto es la limpieza, para que la tabla no
-- crezca con lo que ya nadie puede ver. Se llama desde el mismo sitio que la
-- pide —cargar una ficha— en vez de depender de un cron: es barata, borra en
-- cascada sus likes, comentarios y vistas, y no deja el borrado a merced de
-- una extensión que haya que instalar aparte.
create function public.limpiar_historias()
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with borradas as (
    delete from public.social_posts
    where kind = 'historia'
      and expires_at < now() - interval '7 days'
    returning 1
  )
  select count(*)::integer from borradas;
$$;

comment on function public.limpiar_historias() is
  'Borra las historias caducadas hace más de una semana. La caducidad la aplican las lecturas; esto solo recoge.';

revoke execute on function public.limpiar_historias() from public;
grant execute on function public.limpiar_historias() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. El bucket
-- ---------------------------------------------------------------------------
-- Aparte del de fotos porque este acepta video, y el de fotos tiene un tope de
-- 5 MB que un video de quince segundos se salta. Público de lectura: lo que se
-- publica sale en una ficha pública.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social',
  'social',
  true,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do nothing;

-- La ruta es '<author_id>/<archivo>' y no '<restaurant_id>/...' porque el
-- mismo archivo puede salir en cuatro sucursales: la carpeta dice quién lo
-- subió, que es lo único que no cambia.
create policy social_objects_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'social');

create policy social_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'social'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy social_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'social'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'social'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy social_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'social'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- 10. Dos direcciones más que un restaurante ya no puede tomar
-- ---------------------------------------------------------------------------
-- `/novedades` es el feed del comensal y `/avisos` su bandeja. Las fichas
-- cuelgan de la raíz, así que cada ruta fija nueva tiene que salir de la lista
-- de slugs posibles. La misma lista vive en `lib/slug.js` y las dos tienen que
-- decir lo mismo.
update public.restaurants
  set slug = split_part(slug, '/', 1) || 'restaurante'
             || case when split_part(slug, '/', 2) = '' then ''
                     else '/' || split_part(slug, '/', 2) end
  where split_part(slug, '/', 1) in ('novedades', 'avisos');

alter table public.restaurants
  drop constraint if exists restaurants_slug_formato;

alter table public.restaurants
  add constraint restaurants_slug_formato check (
    slug ~ '^[a-z0-9]{1,60}(/[a-z0-9]{1,60})?$'
    and split_part(slug, '/', 1) !~ '^(api|auth|avisos|entrar|explorar|favicon|icon|menu|novedades|panel|public|q|r|reclamar|recuperar|registro|robots|sitemap|waitlist|_next)$'
    and split_part(slug, '/', 2) <> 'menu'
  );
