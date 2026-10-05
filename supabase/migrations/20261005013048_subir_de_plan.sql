-- Subir de plan pagando por adelantado.
--
-- Hasta aqui, pagar por adelantado un plan distinto del vigente lo empezaba
-- de cero y lo que quedaba del otro se perdia; por eso el panel no lo
-- ofrecia, y quien pago Premium por adelantado no podia pasar a Pedidos hasta
-- que le venciera. Ahora lo que queda de los pagos del plan anterior se
-- convierte en dias del plan nuevo.
--
-- El valor de lo que queda sale de lo que el dueno pago de verdad —la parte
-- sin usar de cada pago aplicado y no devuelto—, no de la vigencia de la ficha
-- ni de los precios de hoy: un pago devuelto no se convierte en dias, y un
-- precio de lanzamiento no se revalua. Ese valor se vuelve dias al precio por
-- dia del pago nuevo, se guarda en `credit_cents` del pago nuevo —para que una
-- devolucion posterior se pueda revisar a mano sabiendo que se movio— y los
-- pagos del plan anterior quedan cerrados en ese momento.
--
-- La firma de la funcion no cambia: el codigo desplegado la llama igual.

alter table public.payments
  add column credit_cents integer not null default 0 check (credit_cents >= 0);

comment on column public.payments.credit_cents is
  'Al subir de plan: el valor sin usar de los pagos del plan anterior que se convirtio en dias de este pago.';

create or replace function public.registrar_pago_por_adelantado(
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
  credito numeric := 0;
  segundos_pagados numeric;
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

  if plan_actual = pago.plan and hasta_actual > base then
    -- Mas meses del mismo plan: se suman al final.
    desde := hasta_actual;
    hasta := desde + make_interval(months => pago.months);
  else
    desde := base;
    hasta := base + make_interval(months => pago.months);

    if plan_actual <> 'basico' and hasta_actual > base then
      -- Cambio de plan con otro vigente. Lo que queda de cada pago del plan
      -- anterior, a lo que se pago por el (incluido lo que ese pago traia de
      -- antes), en proporcion a lo que le falta por correr.
      select coalesce(sum(
        (p.amount_cents + p.credit_cents)
          * extract(epoch from (p.period_end - greatest(p.period_start, base)))
          / nullif(extract(epoch from (p.period_end - p.period_start)), 0)
      ), 0)
      into credito
      from public.payments p
      where p.restaurant_id = pago.restaurant_id
        and p.id <> pago.id
        and p.applied_at is not null
        and p.plan <> pago.plan
        and p.status not in ('refunded', 'charged_back')
        and p.period_end > base;

      -- Ese valor, en dias del plan nuevo a su precio por dia.
      segundos_pagados := extract(epoch from (hasta - desde));
      if credito > 0 and pago.amount_cents > 0 and segundos_pagados > 0 then
        hasta := hasta + make_interval(secs => credito * segundos_pagados / pago.amount_cents);
      end if;

      -- Los pagos del plan anterior ya no cubren nada desde aqui.
      update public.payments p
      set period_end = base, period_start = least(p.period_start, base)
      where p.restaurant_id = pago.restaurant_id
        and p.id <> pago.id
        and p.applied_at is not null
        and p.plan <> pago.plan
        and p.period_end > base;
    end if;
  end if;

  update public.restaurants r
  set plan = pago.plan, premium_until = hasta
  where r.id = pago.restaurant_id;

  update public.payments p
  set applied_at = now(), period_start = desde, period_end = hasta, credit_cents = round(credito)
  where p.id = pago.id;

  return query select pago.status, pago.plan, hasta, true;
end;
$$;

revoke execute on function public.registrar_pago_por_adelantado(
  text, uuid, public.plan_tier, integer, text, text, integer, text, timestamptz, timestamptz
) from public, anon, authenticated;
