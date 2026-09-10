-- Resena verificada por escaneo en el local.
--
-- Contra Google no se gana por volumen de resenas sino por confianza, y el
-- QR de la mesa es la unica prueba de visita que tenemos: nadie puede copiarla
-- sin pegar un QR en cada mesa. Al escanear se guarda un pase de visita; una
-- resena escrita con ese pase queda marcada como verificada. Las demas se
-- siguen mostrando, solo se distinguen.

-- 1. El pase. Cuelga de la cookie anonima del visitante (la misma de los
--    eventos) y, si habia sesion al escanear, tambien de la cuenta: asi vale
--    aunque la resena se escriba desde otro aparato despues de entrar.
create table public.visit_passes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  visitor_id text not null check (length(visitor_id) between 8 and 64),
  profile_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Un pase se canjea por una sola resena. Con la resena borrada, el pase
  -- vuelve a quedar libre mientras no haya caducado.
  used_review_id uuid references public.reviews (id) on delete set null
);

create index visit_passes_visitor_idx on public.visit_passes (restaurant_id, visitor_id);
create index visit_passes_profile_idx on public.visit_passes (profile_id);
create index visit_passes_used_idx on public.visit_passes (used_review_id);

alter table public.visit_passes enable row level security;
-- Sin politicas: nadie lee ni escribe pases directamente. Solo las dos
-- funciones de abajo, que son security definer.

-- Cuanto dura un pase. Una semana: da tiempo a resenar despues de la visita
-- sin que un escaneo de hace un mes cuente como "estuve ahi".
create function public.dias_de_pase() returns integer
language sql immutable as $$ select 7 $$;

-- 2. Registrar el pase al escanear. Va por funcion y no por insert porque
--    quien escanea no tiene sesion. Un mismo visitante en un mismo local
--    renueva su pase libre en vez de acumular uno por escaneo.
create function public.registrar_pase_qr(p_codigo text, p_visitante text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  quien uuid := auth.uid();
  existente uuid;
begin
  if p_visitante is null or length(p_visitante) < 8 or length(p_visitante) > 64 then
    return;
  end if;
  select id into rid from public.restaurants where qr_code = lower(btrim(p_codigo));
  if rid is null then
    return;
  end if;

  select id into existente
  from public.visit_passes
  where restaurant_id = rid
    and visitor_id = p_visitante
    and used_review_id is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if existente is not null then
    update public.visit_passes
    set expires_at = now() + make_interval(days => public.dias_de_pase()),
        profile_id = coalesce(profile_id, quien)
    where id = existente;
  else
    insert into public.visit_passes (restaurant_id, visitor_id, profile_id, expires_at)
    values (rid, p_visitante, quien, now() + make_interval(days => public.dias_de_pase()));
  end if;
end;
$$;

revoke execute on function public.registrar_pase_qr(text, text) from public;
grant execute on function public.registrar_pase_qr(text, text) to anon, authenticated;

-- 3. La marca en la resena. Solo la escribe canjear_pase (definer): un
--    trigger impide que el autor la ponga desde su propia politica de update.
alter table public.reviews
  add column verified_at timestamptz,
  add column visit_pass_id uuid references public.visit_passes (id) on delete set null;

create index reviews_verified_idx on public.reviews (restaurant_id) where verified_at is not null;

create function public.verificada_solo_por_pase()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.verified_at is not null or new.visit_pass_id is not null then
        raise exception 'verificada_solo_por_pase' using errcode = 'insufficient_privilege';
      end if;
    elsif new.verified_at is distinct from old.verified_at
       or new.visit_pass_id is distinct from old.visit_pass_id then
      raise exception 'verificada_solo_por_pase' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.verificada_solo_por_pase() from public, anon, authenticated;

create trigger reviews_verificada_solo_por_pase
  before insert or update of verified_at, visit_pass_id on public.reviews
  for each row execute function public.verificada_solo_por_pase();

-- Canjear: la resena es del que llama, el pase es suyo (por cookie o por
-- cuenta), del mismo local, vigente y sin usar. Devuelve si quedo verificada.
-- Una resena ya verificada no se toca: editarla no la desverifica.
create function public.canjear_pase(p_review uuid, p_visitante text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  quien uuid := auth.uid();
  rid uuid;
  pase uuid;
begin
  if quien is null then
    return false;
  end if;
  select restaurant_id into rid from public.reviews
  where id = p_review and author_id = quien;
  if rid is null then
    return false;
  end if;
  if exists (select 1 from public.reviews where id = p_review and verified_at is not null) then
    return true;
  end if;

  select id into pase
  from public.visit_passes
  where restaurant_id = rid
    and used_review_id is null
    and expires_at > now()
    and (profile_id = quien or (p_visitante is not null and visitor_id = p_visitante))
  order by created_at desc
  limit 1
  for update skip locked;

  if pase is null then
    return false;
  end if;

  update public.visit_passes set used_review_id = p_review, profile_id = coalesce(profile_id, quien) where id = pase;
  update public.reviews set verified_at = now(), visit_pass_id = pase where id = p_review;
  return true;
end;
$$;

revoke execute on function public.canjear_pase(uuid, text) from public, anon;
grant execute on function public.canjear_pase(uuid, text) to authenticated;

-- 4. La ficha enseña la marca.
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
  reported_by_me boolean,
  verified_at timestamptz
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
    ),
    v.verified_at
  from public.reviews v
  join public.profiles p on p.id = v.author_id
  where v.restaurant_id = rid
    and public.restaurant_is_public(rid)
  order by v.created_at desc;
$$;

revoke execute on function public.resenas_restaurante(uuid) from public;
grant execute on function public.resenas_restaurante(uuid) to anon, authenticated;

-- Los pases caducados se barren de aventon, como las historias viejas.
create function public.limpiar_pases()
returns integer
language sql
security definer
set search_path = public
as $$
  with borrados as (
    delete from public.visit_passes
    where expires_at < now() - interval '30 days' and used_review_id is null
    returning 1
  )
  select count(*)::integer from borrados;
$$;

revoke execute on function public.limpiar_pases() from public, anon;
grant execute on function public.limpiar_pases() to authenticated;
