-- Programar historias y publicaciones.
--
-- Hasta aquí publicar era un acto instantáneo: se llenaba el formulario y el
-- contenido salía. Pero el momento importa tanto como el contenido —la
-- promoción del martes se anuncia el martes a las once, no el lunes a las once
-- de la noche que es cuando el dueño tiene tiempo de subirla—, y quien cocina
-- no está frente a la computadora a la hora en que su gente mira el teléfono.
--
-- La salida pasa a ser un dato del contenido, `publish_at`, y no el instante en
-- que se escribió la fila. Con eso:
--
--   * las lecturas esconden lo que todavía no sale, igual que ya escondían la
--     historia caducada: un filtro más en las mismas funciones y ningún
--     proceso del que dependa que la publicación aparezca;
--   * las 24 horas de una historia se cuentan desde que sale y no desde que se
--     guardó, porque si no una historia programada para mañana nacería con
--     media vida gastada;
--   * el dueño sigue viendo lo suyo en el panel —programado incluido—, que es
--     donde tiene que poder cambiar la fecha, adelantarla o borrarla.
--
-- Lo único que no puede esperar a que alguien lea es el aviso a los
-- seguidores: se repartía en el trigger del vínculo, al guardar. Ahora el
-- vínculo lleva `notified_at` y el reparto de lo programado lo hace
-- `repartir_avisos_programados()`, que recoge los pendientes cuya hora ya
-- pasó. Como la barredora de historias, se llama desde donde hay tráfico en
-- vez de depender de un cron.

-- ---------------------------------------------------------------------------
-- 1. Cuándo sale
-- ---------------------------------------------------------------------------

alter table public.social_posts
  add column publish_at timestamptz not null default now();

comment on column public.social_posts.publish_at is
  'Cuándo sale. Igual a created_at en lo que se publica al momento; en el futuro mientras está programado. Las lecturas esconden lo que aún no llega.';

-- Lo que ya existía salió cuando se escribió.
update public.social_posts set publish_at = created_at;

-- El camino que recorren todas las lecturas: lo que ya salió, de lo más nuevo
-- a lo más viejo.
create index social_posts_salida_idx on public.social_posts (publish_at desc);

-- El panel lee lo del dueño por fecha de salida, programado incluido. No hay
-- índice parcial "solo lo programado" porque `now()` no es inmutable y un
-- predicado con ella no puede indexarse.
create index social_posts_autor_salida_idx
  on public.social_posts (author_id, publish_at desc);

create or replace function public.social_post_defaults()
returns trigger
language plpgsql
-- El search_path fijo se le añade de paso: es un trigger que corre con los
-- permisos de quien escribe, y dejarlo mutable es lo que el linter de Supabase
-- venía marcando desde que existe.
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Programar hacia atrás es publicar ahora: una fecha pasada no describe
    -- algo que ya salió, describe un reloj mal puesto.
    if new.publish_at is null or new.publish_at < now() then
      new.publish_at := now();
    end if;

    -- Las 24 horas se cuentan desde que sale. Contarlas desde que se guarda
    -- haría que una historia programada para el viernes naciera caducada.
    if new.kind = 'historia' then
      new.expires_at := new.publish_at + interval '24 hours';
    else
      new.expires_at := null;
    end if;

    return new;
  end if;

  -- Ni el tipo ni la fecha en que se escribió cambian al editar: una historia
  -- caducada no puede volverse una publicación eterna.
  new.kind := old.kind;
  new.created_at := old.created_at;
  new.updated_at := now();

  -- La hora de salida solo se mueve mientras no haya salido. Atrasar lo ya
  -- publicado lo escondería después de que la gente lo vio, y adelantarlo no
  -- significa nada. Adelantar lo programado —"publicar ahora"— es pasarle una
  -- fecha ya vencida, que el mismo redondeo de arriba convierte en now().
  if old.publish_at > now() then
    if new.publish_at is null or new.publish_at < now() then
      new.publish_at := now();
    end if;
  else
    new.publish_at := old.publish_at;
  end if;

  -- La caducidad va detrás de la salida, siempre: reprogramar una historia
  -- mueve sus 24 horas con ella.
  if old.kind = 'historia' then
    new.expires_at := new.publish_at + interval '24 hours';
  else
    new.expires_at := null;
  end if;

  -- Los conteos solo los mueve `contar_social`, que enciende la marca justo
  -- antes de su UPDATE. Cualquier otro update los deja como estaban.
  if coalesce(current_setting('menuabierto.contando', true), 'off') <> 'on' then
    new.likes_count := old.likes_count;
    new.comments_count := old.comments_count;
    new.views_count := old.views_count;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Quién ve qué: lo programado todavía no es de nadie
-- ---------------------------------------------------------------------------

create or replace function public.social_post_visible(target uuid)
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
      and p.publish_at <= now()
      and (p.expires_at is null or p.expires_at > now())
  );
$$;

comment on function public.social_post_visible(uuid) is
  'Responde si esta historia o publicación se puede ver: sale en alguna ficha publicada, su hora ya llegó y todavía no caduca.';

-- ---------------------------------------------------------------------------
-- 3. El aviso espera a que salga
-- ---------------------------------------------------------------------------

alter table public.social_post_restaurants
  add column notified_at timestamptz;

comment on column public.social_post_restaurants.notified_at is
  'Cuándo se repartió el aviso de esta pieza en esta ficha. Nulo mientras está programada; lo llena el trigger al salir o `repartir_avisos_programados`.';

-- Lo pendiente de repartir, que es lo único que el barrido mira.
create index social_post_restaurants_sin_avisar_idx
  on public.social_post_restaurants (post_id)
  where notified_at is null;

-- Ya existente: se repartió en su momento.
update public.social_post_restaurants set notified_at = created_at;

-- El reparto de una pieza en una ficha. Devuelve cuántos avisos se
-- escribieron; marcar la fila es de quien la llama, porque el barrido marca
-- muchas de una vez.
create function public.avisar_de_historia(pid uuid, rid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  tipo public.social_kind;
  autor uuid;
  cuantos integer;
begin
  select p.kind, p.author_id into tipo, autor
    from public.social_posts p
   where p.id = pid and p.publish_at <= now();

  -- Sin fila, todavía programada, o no es una historia: nada que avisar.
  if tipo is distinct from 'historia' then
    return 0;
  end if;

  -- Solo publicada: una historia de una ficha en borrador no le llega a nadie,
  -- igual que la ficha no se ve.
  if not exists (
    select 1 from public.restaurants r
    where r.id = rid and r.status = 'publicado'
  ) then
    return 0;
  end if;

  with repartidos as (
    insert into public.notifications (profile_id, kind, post_id, restaurant_id)
    select f.profile_id, 'historia', pid, rid
      from public.restaurant_followers f
     where f.restaurant_id = rid
       and f.notify_stories
       -- El dueño no se avisa a sí mismo de lo que acaba de publicar.
       and f.profile_id <> autor
    on conflict do nothing
    returning 1
  )
  select count(*)::integer into cuantos from repartidos;

  return cuantos;
end;
$$;

comment on function public.avisar_de_historia(uuid, uuid) is
  'Reparte el aviso de una historia ya salida entre los seguidores de esa ficha con la campana encendida.';

create or replace function public.avisar_historia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Programada: el aviso no sale hoy. La fila se queda con `notified_at` nulo
  -- y la recoge `repartir_avisos_programados` cuando llegue la hora; avisar
  -- ahora sería mandar a la gente a ver algo que todavía no está.
  if not exists (
    select 1 from public.social_posts p
    where p.id = new.post_id and p.publish_at <= now()
  ) then
    return null;
  end if;

  perform public.avisar_de_historia(new.post_id, new.restaurant_id);

  update public.social_post_restaurants
     set notified_at = now()
   where post_id = new.post_id and restaurant_id = new.restaurant_id;

  return null;
end;
$$;

-- El barrido de lo programado que ya salió. Es lo único que la programación
-- necesita que alguien ejecute: la pieza se ve sola en cuanto pasa su hora
-- —las lecturas la filtran por `publish_at`— pero el aviso hay que mandarlo.
--
-- Se marca también lo que no genera aviso (las publicaciones, las fichas en
-- borrador): `notified_at` quiere decir "ya resuelto", no "se mandó algo", y
-- así la lista de pendientes no crece con filas que nunca van a repartir nada.
create function public.repartir_avisos_programados()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  fila record;
  cuantos integer := 0;
begin
  for fila in
    select pr.post_id, pr.restaurant_id
      from public.social_post_restaurants pr
      join public.social_posts p on p.id = pr.post_id
     where pr.notified_at is null
       and p.publish_at <= now()
     limit 200
  loop
    cuantos := cuantos + public.avisar_de_historia(fila.post_id, fila.restaurant_id);

    update public.social_post_restaurants
       set notified_at = now()
     where post_id = fila.post_id and restaurant_id = fila.restaurant_id;
  end loop;

  return cuantos;
end;
$$;

comment on function public.repartir_avisos_programados() is
  'Manda los avisos de las historias programadas cuya hora ya pasó. Se llama desde las páginas con tráfico, como la barredora de historias.';

-- `avisar_de_historia` no la llama nadie de fuera: es el cuerpo compartido del
-- trigger y del barrido. `repartir_avisos_programados` sí, pero solo con
-- sesión. Los roles se nombran uno por uno porque en las funciones nuevas
-- Supabase concede a `anon` y `authenticated` por separado, y revocar de
-- `public` no se los quita.
revoke execute on function public.avisar_de_historia(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.repartir_avisos_programados() from public, anon;
grant execute on function public.repartir_avisos_programados() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Las lecturas
-- ---------------------------------------------------------------------------
-- Todas ganan el mismo filtro: lo que aún no sale no existe para nadie salvo
-- para su dueño en el panel.

create or replace function public.historias_restaurante(rid uuid)
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
    and p.publish_at <= now()
    and p.expires_at > now()
    and (
      public.restaurant_is_public(rid)
      or public.owns_restaurant(rid)
    )
  order by p.publish_at asc;
$$;

create or replace function public.publicaciones_restaurante(
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
    -- La fecha que la ficha enseña es la de salida: en algo programado,
    -- "hace 3 días" contado desde que se escribió sería mentira.
    p.publish_at,
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
    and p.publish_at <= now()
    and (antes is null or p.publish_at < antes)
    and (
      public.restaurant_is_public(rid)
      or public.owns_restaurant(rid)
    )
  order by p.publish_at desc
  limit least(greatest(limite, 1), 20);
$$;

comment on function public.publicaciones_restaurante(uuid, integer, timestamptz) is
  'Publicaciones ya salidas de una ficha, de la más nueva a la más vieja. `antes` pagina por la fecha de salida.';

create or replace function public.feed_seguidos(
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
    p.publish_at,
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
    and p.publish_at <= now()
    and (p.expires_at is null or p.expires_at > now())
    and (antes is null or p.publish_at < antes)
  order by p.publish_at desc
  limit least(greatest(limite, 1), 30);
$$;

-- La lista del panel devuelve una columna más, `publish_at`, y una función de
-- Postgres no puede cambiar su tipo de retorno con `create or replace`: hay
-- que tirarla y volver a crearla. Los permisos se van con ella, así que se
-- vuelven a conceder debajo.
drop function public.social_mias(integer, timestamptz);

-- El panel sí ve lo programado: es el único sitio donde se puede cambiar la
-- fecha, adelantarla o borrarla antes de que salga, y esconderlo ahí sería
-- perderlo. Va con su `publish_at` para que la tarjeta pueda decir cuándo sale.
create or replace function public.social_mias(
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
  publish_at timestamptz,
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
    p.publish_at,
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
    and (antes is null or p.publish_at < antes)
  -- Lo programado va arriba, y entre lo programado primero lo que sale antes:
  -- es una agenda, y una agenda se lee por lo que viene.
  order by (p.publish_at > now()) desc,
           case when p.publish_at > now() then p.publish_at end asc,
           p.publish_at desc
  limit least(greatest(limite, 1), 50);
$$;

comment on function public.social_mias(integer, timestamptz) is
  'Lo que publicó o programó quien está firmado, con sus restaurantes y sus números. Es la lista del panel.';

-- `anon` se nombra aparte por lo mismo que arriba: al recrear la función,
-- Supabase le concede el permiso de nuevo, y la lista del panel no es para
-- quien no ha entrado.
revoke execute on function public.social_mias(integer, timestamptz) from public, anon;
grant execute on function public.social_mias(integer, timestamptz) to authenticated;

-- El aviso de una historia programada apunta a algo que ya salió, así que
-- `vigente` sigue queriendo decir lo mismo; el filtro se añade por si el
-- reparto llegara a adelantarse.
create or replace function public.mis_avisos(limite integer default 30)
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
    (p.id is null or (p.publish_at <= now() and (p.expires_at is null or p.expires_at > now())))
  from public.notifications n
  join public.restaurants r on r.id = n.restaurant_id
  left join public.social_posts p on p.id = n.post_id
  where n.profile_id = (select auth.uid())
  order by n.created_at desc
  limit least(greatest(limite, 1), 50);
$$;
