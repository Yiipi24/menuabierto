-- Pagar el plan por adelantado: de uno a doce meses de una vez, con OXXO,
-- SPEI, saldo de Mercado Pago o tarjeta.
--
-- La suscripcion (`subscriptions`) cobra sola cada mes, pero solo a una
-- tarjeta: en Mexico, Mercado Pago no cobra en automatico ni a OXXO ni a
-- SPEI. El dueno que no tiene tarjeta, o no quiere dejarla guardada, paga el
-- plan como un pago suelto que compra meses. Aqui se guarda cada pago y, sobre
-- todo, se aplica una sola vez: Mercado Pago avisa del mismo pago varias veces
-- (creado, actualizado, reintentos), y un pago aplicado dos veces serian meses
-- regalados.

-- 1. Los pagos. Uno por pago de la pasarela; una ficha puede tener varios
--    (pago tres meses, despues otros seis).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  provider text not null default 'mercadopago' check (provider in ('mercadopago', 'stripe')),
  -- El id del pago en la pasarela.
  provider_id text not null check (provider_id ~ '^[0-9]{1,30}$'),
  plan public.plan_tier not null check (plan <> 'basico'),
  months smallint not null check (months between 1 and 12),
  -- Los estados de Mercado Pago tal cual. Un pago en OXXO o por SPEI nace
  -- `pending` y pasa a `approved` cuando el dueno paga.
  status text not null check (status in (
    'pending', 'in_process', 'authorized', 'approved', 'rejected',
    'cancelled', 'refunded', 'charged_back', 'in_mediation'
  )),
  -- Como se pago, con el nombre de la pasarela: ticket (OXXO y otras
  -- tiendas), bank_transfer (SPEI), atm, account_money, credit_card...
  method text check (method is null or length(method) <= 40),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'MXN',
  -- Hasta cuando se puede pagar la ficha de OXXO o la referencia de SPEI.
  expires_at timestamptz,
  approved_at timestamptz,
  -- Lo que compro, una vez aplicado: de cuando a cuando corre el plan.
  period_start timestamptz,
  period_end timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_id),
  constraint payments_aplicado_completo check (
    (applied_at is null) = (period_end is null)
    and (period_start is null) = (period_end is null)
  )
);

comment on table public.payments is
  'Pagos por adelantado de un plan (OXXO, SPEI, saldo o tarjeta). Los escribe solo la llave de servicio, con registrar_pago_por_adelantado().';

create index payments_restaurant_idx on public.payments (restaurant_id, created_at desc);

create trigger payments_touch
  before update on public.payments
  for each row execute function public.touch_updated_at();

-- 2. RLS: el dueno ve los suyos; nadie mas que el servicio escribe.
alter table public.payments enable row level security;

create policy payments_select_own on public.payments
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

-- 3. Registrar un pago y, si ya esta aprobado, aplicarlo.
--
--    Todo en una transaccion: el insert ... on conflict bloquea la fila del
--    pago, asi que dos avisos del mismo pago atendidos a la vez se forman, y
--    el segundo ve `applied_at` del primero. Lo que se sabe del pago lo pone
--    la pasarela (quien llama lo acaba de pedir a su API); la ficha, el plan y
--    los meses se fijan con el primer aviso y no cambian despues.
--
--    Los meses se cuentan desde que se aprobo el pago, no desde que llego el
--    aviso: un webhook atrasado no le quita dias a quien ya pago. Si la ficha
--    ya tiene ese mismo plan vigente, se suman al final. Si tiene otro plan
--    vigente, el nuevo empieza ya; el panel no ofrece cambiar de plan con uno
--    vigente, asi que eso solo pasa si alguien paga una ficha de OXXO vieja.
create function public.registrar_pago_por_adelantado(
  p_provider_id text,
  p_restaurant uuid,
  p_plan public.plan_tier,
  p_months integer,
  p_status text,
  p_method text,
  p_amount_cents integer,
  p_currency text,
  p_expires_at timestamptz,
  p_approved_at timestamptz
)
returns table (status text, plan public.plan_tier, premium_until timestamptz, aplicado boolean)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  pago public.payments%rowtype;
  plan_actual public.plan_tier;
  hasta_actual timestamptz;
  base timestamptz;
  desde timestamptz;
  hasta timestamptz;
begin
  insert into public.payments as p (
    provider, provider_id, restaurant_id, plan, months, status, method,
    amount_cents, currency, expires_at, approved_at
  )
  values (
    'mercadopago', p_provider_id, p_restaurant, p_plan, p_months, p_status, p_method,
    p_amount_cents, coalesce(p_currency, 'MXN'), p_expires_at, p_approved_at
  )
  on conflict (provider, provider_id) do update set
    -- Un pago aprobado no vuelve a pendiente: un aviso viejo que se atiende
    -- tarde no debe deshacer lo que uno nuevo ya confirmo.
    status = case
      when p.status = 'approved' and excluded.status in ('pending', 'in_process', 'authorized')
        then p.status
      else excluded.status
    end,
    method = coalesce(excluded.method, p.method),
    expires_at = coalesce(excluded.expires_at, p.expires_at),
    approved_at = coalesce(p.approved_at, excluded.approved_at)
  returning p.* into pago;

  if pago.status <> 'approved' or pago.applied_at is not null then
    return query select pago.status, pago.plan, pago.period_end, false;
    return;
  end if;

  select r.plan, r.premium_until into plan_actual, hasta_actual
  from public.restaurants r
  where r.id = pago.restaurant_id
  for update;

  base := least(coalesce(pago.approved_at, now()), now());
  desde := case
    when plan_actual = pago.plan and hasta_actual > base then hasta_actual
    else base
  end;
  hasta := desde + make_interval(months => pago.months);

  update public.restaurants r
  set plan = pago.plan, premium_until = hasta
  where r.id = pago.restaurant_id;

  update public.payments p
  set applied_at = now(), period_start = desde, period_end = hasta
  where p.id = pago.id;

  return query select pago.status, pago.plan, hasta, true;
end;
$$;

revoke execute on function public.registrar_pago_por_adelantado(
  text, uuid, public.plan_tier, integer, text, text, integer, text, timestamptz, timestamptz
) from public, anon, authenticated;

-- 4. El plan que deja una suscripcion, sin recortar lo pagado por adelantado.
--
--    La sincronizacion de la suscripcion calcula el plan con lo que dice la
--    pasarela, y antes lo escribia directo en la ficha. Con meses pagados por
--    adelantado eso los podia recortar: un aviso tardio de una suscripcion ya
--    cancelada baja la vigencia a su ultimo cobro. Aqui se escribe con la fila
--    de la ficha bloqueada —el mismo candado que toma
--    registrar_pago_por_adelantado—, asi que los dos caminos se forman y el
--    segundo ve lo que escribio el primero. Lo pagado por adelantado manda
--    mientras corre; si la suscripcion da mas dias del mismo plan, se quedan
--    los mas. Un pago devuelto o con contracargo ya no cuenta.
create function public.aplicar_plan_de_suscripcion(
  p_restaurant uuid,
  p_plan public.plan_tier,
  p_premium_until timestamptz
)
returns table (plan public.plan_tier, premium_until timestamptz)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  plan_adelanto public.plan_tier;
  hasta_adelanto timestamptz;
  plan_final public.plan_tier := p_plan;
  hasta_final timestamptz := p_premium_until;
begin
  perform 1 from public.restaurants r where r.id = p_restaurant for update;
  if not found then
    raise exception 'ficha_no_existe' using errcode = 'no_data_found';
  end if;

  select p.plan, p.period_end into plan_adelanto, hasta_adelanto
  from public.payments p
  where p.restaurant_id = p_restaurant
    and p.applied_at is not null
    and p.status not in ('refunded', 'charged_back')
    and p.period_end > now()
  order by p.period_end desc
  limit 1;

  if hasta_adelanto is not null
     and not (p_plan = plan_adelanto and p_premium_until > hasta_adelanto) then
    plan_final := plan_adelanto;
    hasta_final := hasta_adelanto;
  end if;

  update public.restaurants r
  set plan = plan_final, premium_until = case when plan_final = 'basico' then null else hasta_final end
  where r.id = p_restaurant;

  return query select plan_final, case when plan_final = 'basico' then null else hasta_final end;
end;
$$;

revoke execute on function public.aplicar_plan_de_suscripcion(uuid, public.plan_tier, timestamptz)
  from public, anon, authenticated;
