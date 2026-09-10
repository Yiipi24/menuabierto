-- Cobrar Plus y Premium de verdad.
--
-- Hasta aqui el plan de una ficha era una columna que nadie escribia: la base
-- ya sabia contar menus por plan y degradar uno vencido, pero no habia forma
-- de contratar ninguno. Aqui entra lo que faltaba del lado de la base: donde
-- se guarda la suscripcion de la pasarela y, sobre todo, quien tiene permiso
-- de mover el plan.

-- 1. El plan lo mueve el cobro, no el dueno.
--
-- La politica de update de restaurants deja al dueno escribir cualquier
-- columna de su ficha, y `plan` era una de ellas: bastaba un PATCH a la API
-- con la llave publicable para ponerse Premium. Un privilegio por columna no
-- sirve aqui —el GRANT de tabla los tapa—, asi que lo hace un trigger: las
-- dos columnas solo cambian desde la llave de servicio, que es la que usa el
-- webhook de la pasarela. Una ficha nueva nace en basico siempre.
create or replace function public.plan_solo_desde_el_cobro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.plan <> 'basico' or new.premium_until is not null then
        raise exception 'plan_solo_desde_el_cobro: el plan lo asigna el cobro'
          using errcode = 'insufficient_privilege';
      end if;
    elsif new.plan is distinct from old.plan
       or new.premium_until is distinct from old.premium_until then
      raise exception 'plan_solo_desde_el_cobro: el plan lo asigna el cobro'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.plan_solo_desde_el_cobro() from anon, authenticated, public;

drop trigger if exists restaurants_plan_solo_desde_el_cobro on public.restaurants;
create trigger restaurants_plan_solo_desde_el_cobro
  before insert or update of plan, premium_until on public.restaurants
  for each row execute function public.plan_solo_desde_el_cobro();

-- 2. La suscripcion. Una por restaurante —se cobra por ficha, no por cuenta—
--    y con la pasarela como columna: hoy es Mercado Pago, y cambiarla o sumar
--    otra no deberia ser una tabla nueva.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  provider text not null default 'mercadopago' check (provider in ('mercadopago', 'stripe')),
  -- El id de la suscripcion en la pasarela (preapproval_id en Mercado Pago).
  provider_id text not null,
  plan public.plan_tier not null check (plan <> 'basico'),
  -- Los estados de Mercado Pago tal cual: pending (no ha pagado la primera),
  -- authorized (al corriente), paused (un cobro fallo y lo esta reintentando)
  -- y cancelled.
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'paused', 'cancelled')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'MXN',
  payer_email text,
  -- Hasta cuando esta pagado segun la pasarela. premium_until en restaurants
  -- sale de aqui mas la gracia.
  next_payment_at timestamptz,
  cancelled_at timestamptz,
  -- La ultima vez que la pasarela nos dijo algo de esta suscripcion. Un
  -- webhook viejo que llega tarde no debe pisar uno mas nuevo.
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_id)
);

comment on table public.subscriptions is
  'Suscripcion de paga de una ficha en la pasarela. La escribe solo la llave de servicio (webhook y acciones de cobro).';

create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- 3. RLS: el dueno la ve, nadie mas que el servicio la escribe. Sin politica
--    de insert/update/delete para anon y authenticated, PostgREST los rechaza.
alter table public.subscriptions enable row level security;

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));
