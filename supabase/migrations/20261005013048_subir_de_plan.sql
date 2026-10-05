-- Subir de plan pagando por adelantado.
--
-- Hasta aqui, pagar por adelantado un plan distinto del vigente lo empezaba
-- de cero y lo que quedaba del otro se perdia; por eso el panel no lo
-- ofrecia, y quien pago Premium por adelantado no podia pasar a Pedidos hasta
-- que le venciera. Ahora lo que queda del plan vigente se convierte en dias
-- del plan nuevo, a su precio: diez dias de Premium a $399 son un poco menos
-- de dos de Pedidos a $2,200. Los pagos del plan anterior quedan cerrados en
-- ese momento, para que no sigan contando como vigentes.
--
-- Los precios los manda quien llama (`p_precios`, los mismos de
-- lib/cobro.js), porque viven en variables de entorno y no en la base. Sin
-- ellos el cambio de plan empieza de cero, como antes: el codigo que ya esta
-- desplegado llama sin ese argumento y sigue funcionando igual.

drop function public.registrar_pago_por_adelantado(
  text, uuid, public.plan_tier, integer, text, text, integer, text, timestamptz, timestamptz
);

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
  p_approved_at timestamptz,
  p_precios jsonb default null
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
  precio_actual numeric;
  precio_nuevo numeric;
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
      -- Cambio de plan con otro vigente: lo que quedaba se vuelve dias del
      -- nuevo, a su precio.
      precio_actual := (p_precios ->> plan_actual::text)::numeric;
      precio_nuevo := (p_precios ->> pago.plan::text)::numeric;
      if precio_actual > 0 and precio_nuevo > 0 then
        hasta := hasta + (hasta_actual - base) * (precio_actual / precio_nuevo)::double precision;
      end if;

      -- Los pagos del plan anterior ya no cubren nada desde aqui.
      update public.payments p
      set period_end = base, period_start = least(p.period_start, base)
      where p.restaurant_id = pago.restaurant_id
        and p.applied_at is not null
        and p.plan <> pago.plan
        and p.period_end > base;
    end if;
  end if;

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
  text, uuid, public.plan_tier, integer, text, text, integer, text, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
