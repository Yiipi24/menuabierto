-- La resena despues del pedido: un enlace de un solo uso por pedido.
--
-- Al marcar un pedido como entregado, el asistente le manda al cliente un
-- enlace para dejar su resena, y abrirlo le deja un pase de visita como el
-- del QR de la mesa: la compra es la prueba, y la resena sale verificada. El
-- enlace no puede ser el del QR —es permanente, y reenviado daria pases a
-- quien nunca pidio—, asi que cada pedido entregado tiene su propio token, que
-- se gasta la primera vez que alguien lo abre y caduca a los treinta dias.

alter table public.orders
  add column review_token text unique
    check (review_token is null or review_token ~ '^[a-f0-9]{32}$'),
  add column review_token_used_at timestamptz;

comment on column public.orders.review_token is
  'Token del enlace de resena que se le manda al cliente al entregar. De un solo uso (review_token_used_at).';

-- 1. El token: lo pide el dueno al marcar el pedido como entregado. Si ya
--    tenia uno, devuelve el mismo.
create function public.token_de_resena(p_order uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
  estado text;
  actual text;
  nuevo text;
begin
  select o.restaurant_id, o.status, o.review_token into rid, estado, actual
  from public.orders o
  where o.id = p_order
  for update;

  if rid is null then
    raise exception 'pedido_no_existe' using errcode = 'no_data_found';
  end if;
  if not public.owns_restaurant(rid) then
    raise exception 'solo_el_dueno' using errcode = 'insufficient_privilege';
  end if;
  if estado <> 'entregado' then
    return null;
  end if;
  if actual is not null then
    return actual;
  end if;

  nuevo := replace(gen_random_uuid()::text, '-', '');
  update public.orders set review_token = nuevo where id = p_order;
  return nuevo;
end;
$$;

revoke execute on function public.token_de_resena(uuid) from public, anon;
grant execute on function public.token_de_resena(uuid) to authenticated;

-- 2. Abrir el enlace: gasta el token y deja el pase de visita, igual que
--    `registrar_pase_qr` (un mismo visitante renueva su pase libre en vez de
--    acumular otro). Devuelve el slug de la ficha para llevarlo a sus
--    resenas; con el token ya gastado o caducado lo lleva igual, sin pase.
create function public.pase_de_pedido(p_token text, p_visitante text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pedido_id uuid;
  rid uuid;
  usado timestamptz;
  entregado timestamptz;
  ficha text;
  quien uuid := auth.uid();
  existente uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    return null;
  end if;

  select o.id, o.restaurant_id, o.review_token_used_at, o.status_at
    into pedido_id, rid, usado, entregado
  from public.orders o
  where o.review_token = p_token and o.status = 'entregado'
  for update;
  if pedido_id is null then
    return null;
  end if;

  select r.slug into ficha from public.restaurants r where r.id = rid and r.status = 'publicado';
  if ficha is null then
    return null;
  end if;

  if usado is not null
     or entregado < now() - interval '30 days'
     or p_visitante is null or length(p_visitante) < 8 or length(p_visitante) > 64 then
    return ficha;
  end if;

  update public.orders set review_token_used_at = now() where id = pedido_id;

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

  return ficha;
end;
$$;

revoke execute on function public.pase_de_pedido(text, text) from public;
grant execute on function public.pase_de_pedido(text, text) to anon, authenticated;
