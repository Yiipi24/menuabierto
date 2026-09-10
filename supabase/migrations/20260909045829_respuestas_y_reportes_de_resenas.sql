-- Respuesta del dueno y moderacion de resenas.
--
-- Hasta aqui cualquiera con cuenta resenaba y el dueno no podia contestar, y
-- una resena falsa se quedaba para siempre. Entran tres cosas: la respuesta
-- publica del dueno (una por resena, editable), el reporte de una resena por
-- parte del dueno o de un comensal con su cola de revision, y el aviso al
-- dueno cuando le llega una resena, reusando la bandeja que ya existe.

-- 1. La respuesta vive en la propia resena: es una por resena y se lee junto
--    a ella. No se abre la columna por RLS —la politica de update es del
--    autor— sino por una funcion que comprueba que quien responde es el dueno.
alter table public.reviews
  add column owner_reply text check (owner_reply is null or length(owner_reply) <= 1000),
  add column owner_reply_at timestamptz;

create function public.responder_resena(p_review uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  autor uuid;
  texto text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  select restaurant_id, author_id into rid, autor
  from public.reviews where id = p_review;
  if rid is null then
    raise exception 'resena_no_existe' using errcode = 'no_data_found';
  end if;
  if not public.owns_restaurant(rid) then
    raise exception 'solo_el_dueno_responde' using errcode = 'insufficient_privilege';
  end if;

  update public.reviews
  set owner_reply = texto,
      owner_reply_at = case when texto is null then null else now() end
  where id = p_review;

  -- Al autor se le avisa una vez por respuesta nueva; editar la respuesta no
  -- vuelve a avisar, y borrarla tampoco.
  if texto is not null then
    insert into public.notifications (profile_id, kind, review_id, restaurant_id)
    values (autor, 'respuesta', p_review, rid)
    on conflict do nothing;
  end if;
end;
$$;

revoke execute on function public.responder_resena(uuid, text) from public, anon;
grant execute on function public.responder_resena(uuid, text) to authenticated;

-- 2. Los reportes. Una resena reportada no desaparece sola: queda en cola y
--    alguien la revisa. Se puede reportar una vez por persona mientras siga
--    pendiente; el autor no reporta la suya (la borra).
create table public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('falsa', 'ofensiva', 'spam', 'otra')),
  detail text check (detail is null or length(detail) <= 500),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'conservada', 'retirada')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

create unique index review_reports_pendiente_idx
  on public.review_reports (review_id, reporter_id)
  where status = 'pendiente';
create index review_reports_cola_idx on public.review_reports (status, created_at);
create index review_reports_restaurant_idx on public.review_reports (restaurant_id);
create index review_reports_reporter_idx on public.review_reports (reporter_id);
create index review_reports_resolved_by_idx on public.review_reports (resolved_by);

alter table public.review_reports enable row level security;

-- Quien reporto ve su reporte; el dueno ve los de su ficha. Se escribe solo
-- por la funcion de abajo.
create policy review_reports_select on public.review_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.owns_restaurant(restaurant_id));

create function public.reportar_resena(p_review uuid, p_reason text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  autor uuid;
  quien uuid := auth.uid();
begin
  if quien is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  select restaurant_id, author_id into rid, autor
  from public.reviews where id = p_review;
  if rid is null or not public.restaurant_is_public(rid) then
    raise exception 'resena_no_existe' using errcode = 'no_data_found';
  end if;
  if autor = quien then
    raise exception 'no_se_reporta_la_propia' using errcode = 'check_violation';
  end if;

  insert into public.review_reports (review_id, restaurant_id, reporter_id, reason, detail)
  values (p_review, rid, quien, p_reason, nullif(btrim(coalesce(p_detail, '')), ''));
exception
  when unique_violation then
    -- Ya la reporto y sigue pendiente: para quien reporta es lo mismo.
    return;
end;
$$;

revoke execute on function public.reportar_resena(uuid, text, text) from public, anon;
grant execute on function public.reportar_resena(uuid, text, text) to authenticated;

-- Resolver la cola: solo la llave de servicio. Conservar cierra el reporte;
-- retirar borra la resena (y con ella los reportes, en cascada), y el
-- promedio se recalcula con el trigger de siempre.
create function public.resolver_reporte(p_report uuid, p_accion text, p_resolved_by uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rev uuid;
begin
  select review_id into rev from public.review_reports
  where id = p_report and status = 'pendiente' for update;
  if rev is null then
    raise exception 'reporte_no_pendiente' using errcode = 'no_data_found';
  end if;

  if p_accion = 'retirar' then
    delete from public.reviews where id = rev;
  elsif p_accion = 'conservar' then
    update public.review_reports
    set status = 'conservada', resolved_at = now(), resolved_by = p_resolved_by
    where review_id = rev and status = 'pendiente';
  else
    raise exception 'accion_desconocida' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.resolver_reporte(uuid, text, uuid) from public, anon, authenticated;

-- 3. Avisos. La bandeja admitia solo historias; entran la resena nueva (al
--    dueno) y la respuesta del dueno (al autor). Cuelgan de la resena y no de
--    una publicacion, asi que la tabla gana esa columna y su indice unico.
alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check check (kind in ('historia', 'resena', 'respuesta')),
  add column review_id uuid references public.reviews (id) on delete cascade;

create index notifications_review_idx on public.notifications (review_id);

create unique index notifications_sin_repetir_resena
  on public.notifications (profile_id, kind, review_id)
  where review_id is not null;

create function public.avisar_de_resena()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dueno uuid;
begin
  select owner_id into dueno from public.restaurants where id = new.restaurant_id;
  if dueno is not null and dueno <> new.author_id then
    insert into public.notifications (profile_id, kind, review_id, restaurant_id)
    values (dueno, 'resena', new.id, new.restaurant_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.avisar_de_resena() from public, anon, authenticated;

create trigger reviews_avisar_al_dueno
  after insert on public.reviews
  for each row execute function public.avisar_de_resena();

-- 4. Lo que la ficha enseña de cada resena: ademas de lo de siempre, la
--    respuesta del dueno y si esta reportada (solo el dueno y quien la
--    reporto lo ven; para el resto la resena se ve normal hasta que se
--    resuelva).
drop function public.resenas_restaurante(uuid);
create function public.resenas_restaurante(rid uuid)
returns table (
  id uuid,
  rating smallint,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  author_id uuid,
  author_name text,
  author_reviews integer,
  owner_reply text,
  owner_reply_at timestamptz,
  report_pending boolean,
  reported_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.rating,
    v.body,
    v.created_at,
    v.updated_at,
    v.author_id,
    coalesce(nullif(btrim(p.full_name), ''), 'Comensal'),
    p.reviews_count,
    v.owner_reply,
    v.owner_reply_at,
    exists (
      select 1 from public.review_reports rp
      where rp.review_id = v.id and rp.status = 'pendiente'
    ),
    exists (
      select 1 from public.review_reports rp
      where rp.review_id = v.id and rp.status = 'pendiente'
        and rp.reporter_id = auth.uid()
    )
  from public.reviews v
  join public.profiles p on p.id = v.author_id
  where v.restaurant_id = rid
    and public.restaurant_is_public(rid)
  order by v.created_at desc;
$$;

comment on function public.resenas_restaurante(uuid) is
  'Resenas publicas de un restaurante con el nombre de quien las escribio, la respuesta del dueno y si hay un reporte pendiente. Security definer para leer profiles.full_name sin abrir el resto del perfil.';

revoke execute on function public.resenas_restaurante(uuid) from public;
grant execute on function public.resenas_restaurante(uuid) to anon, authenticated;

-- 5. La bandeja, con los dos tipos nuevos: trae de que resena se trata para
--    poder decir "Ana te dejo 5 estrellas" sin otra consulta.
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
  review_excerpt text
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
    left(coalesce(case when n.kind = 'respuesta' then v.owner_reply else v.body end, ''), 120)
  from public.notifications n
  join public.restaurants r on r.id = n.restaurant_id
  left join public.social_posts p on p.id = n.post_id
  left join public.reviews v on v.id = n.review_id
  left join public.profiles pa on pa.id = v.author_id
  where n.profile_id = (select auth.uid())
  order by n.created_at desc
  limit least(greatest(limite, 1), 50);
$$;

revoke execute on function public.mis_avisos(integer) from public, anon;
grant execute on function public.mis_avisos(integer) to authenticated;
