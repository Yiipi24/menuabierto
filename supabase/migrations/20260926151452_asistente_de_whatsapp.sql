-- El asistente de WhatsApp: contesta lo que se pregunta por chat y toma
-- pedidos que llegan al panel.
--
-- "Pedir por WhatsApp" ya existia, pero terminaba en un mensaje escrito en el
-- chat del restaurante: nadie contestaba el horario a las once de la noche, y
-- el pedido no quedaba en ningun lado. Con un numero conectado a la Cloud API
-- de WhatsApp, el sitio contesta solo —el horario, la pagina, el menu con su
-- PDF, la direccion— y arma el pedido platillo por platillo con los precios de
-- la carta. El pedido se guarda aqui, le llega al dueno como aviso y lo
-- atiende desde su panel.
--
-- Todo lo de este archivo lo escribe la llave de servicio —el webhook de Meta
-- y el script que conecta un numero—, salvo el cambio de estado de un pedido,
-- que es del dueno y pasa por una funcion que lo comprueba.

-- 1. Que numero atiende a que restaurante.
--
--    Meta manda todos los mensajes de todos los numeros al mismo webhook, y lo
--    unico que dice de a quien le escribieron es el `phone_number_id`. Esta
--    tabla lo traduce a una ficha. No la escribe el dueno: quien pudiera
--    apuntar un numero a su restaurante podria quedarse con los mensajes de
--    otro. La conecta el equipo con `npm run whatsapp`.
create table public.whatsapp_lines (
  phone_number_id text primary key check (phone_number_id ~ '^[0-9]{5,30}$'),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  -- El numero como lo marca un cliente, en formato wa.me.
  display_phone text not null check (display_phone ~ '^[0-9]{11,15}$'),
  waba_id text check (waba_id is null or waba_id ~ '^[0-9]{5,30}$'),
  is_active boolean not null default true,
  -- Si el restaurante sigue contestando desde la app de WhatsApp Business en
  -- el mismo numero (coexistencia). Solo entonces "hablar con alguien" calla
  -- al asistente: sin nadie del otro lado, callarlo dejaria al cliente
  -- hablandole a la pared.
  answers_in_app boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.whatsapp_lines is
  'Numero de WhatsApp (Cloud API) conectado a una ficha. Solo lo escribe la llave de servicio.';

create trigger whatsapp_lines_touch
  before update on public.whatsapp_lines
  for each row execute function public.touch_updated_at();

alter table public.whatsapp_lines enable row level security;

-- El dueno ve si su asistente esta conectado y a que numero; no lo cambia.
create policy whatsapp_lines_select_own on public.whatsapp_lines
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

-- 2. La conversacion en curso: en que paso va, que lleva en el pedido y si
--    alguien del restaurante tomo el chat a mano.
--
--    El cliente se identifica por su telefono y, desde 2026, tambien por el
--    id que WhatsApp le da dentro de cada empresa (BSUID): quien adopte un
--    nombre de usuario puede esconder su numero, y entonces el webhook solo
--    trae el id. `customer` es la llave: el telefono si llego, si no el id.
create table public.whatsapp_chats (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer text not null check (length(customer) between 6 and 140),
  customer_phone text check (customer_phone is null or customer_phone ~ '^[0-9]{6,20}$'),
  customer_user_id text check (customer_user_id is null or length(customer_user_id) <= 140),
  customer_name text check (customer_name is null or length(customer_name) <= 80),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  -- La ultima vez que el cliente escribio. Contestar gratis y sin plantilla
  -- solo se puede dentro de las 24 horas siguientes.
  last_inbound_at timestamptz,
  -- Hasta cuando el asistente se queda callado en este chat: el cliente pidio
  -- hablar con alguien, o el dueno contesto a mano desde su telefono.
  paused_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, customer)
);

create index whatsapp_chats_user_idx
  on public.whatsapp_chats (restaurant_id, customer_user_id)
  where customer_user_id is not null;

create trigger whatsapp_chats_touch
  before update on public.whatsapp_chats
  for each row execute function public.touch_updated_at();

-- Sin politicas: nadie mas que la llave de servicio lee ni escribe aqui.
alter table public.whatsapp_chats enable row level security;

-- 3. Los mensajes ya atendidos. Meta reintenta lo que cree que no llego, y un
--    mismo "si, confirmo" atendido dos veces serian dos pedidos.
create table public.whatsapp_inbound (
  id text primary key check (length(id) between 1 and 200),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index whatsapp_inbound_limpieza_idx
  on public.whatsapp_inbound (restaurant_id, created_at);

alter table public.whatsapp_inbound enable row level security;

-- Devuelve true la primera vez que ve un mensaje y false las demas. La
-- limpieza va de aventon, sin cron: Meta deja de reintentar a los siete dias,
-- y pasado eso la fila ya no protege de nada.
create function public.whatsapp_mensaje_nuevo(p_id text, p_restaurant uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  nuevo boolean;
begin
  insert into public.whatsapp_inbound (id, restaurant_id)
  values (p_id, p_restaurant)
  on conflict (id) do nothing;
  nuevo := found;

  if nuevo then
    delete from public.whatsapp_inbound
    where restaurant_id = p_restaurant
      and created_at < now() - interval '7 days';
  end if;

  return nuevo;
end;
$$;

revoke execute on function public.whatsapp_mensaje_nuevo(text, uuid) from public, anon, authenticated;

-- 4. Los pedidos.
--
--    Los platillos se guardan como se cotizaron —nombre, cantidad y precio en
--    el momento— y no como un enlace a la carta: el precio del ribeye puede
--    cambiar manana y el pedido de hoy tiene que seguir diciendo lo que se le
--    dijo al cliente. Un restaurante con la carta en PDF no tiene platillos que
--    enlazar, y ahi el pedido llega como texto libre (`details`).
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- Corto y sin letras que se confundan: es lo que se dice en el mostrador.
  code text not null check (code ~ '^[A-Z0-9]{4,8}$'),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  -- Como se armo: platillo por platillo en el chat, desde la carta de la
  -- ficha, o escrito a mano.
  origin text not null check (origin in ('chat', 'carta', 'texto')),
  status text not null default 'nuevo'
    check (status in ('nuevo', 'aceptado', 'listo', 'entregado', 'cancelado')),
  status_at timestamptz not null default now(),
  customer_name text check (customer_name is null or length(customer_name) <= 80),
  customer_phone text check (customer_phone is null or customer_phone ~ '^[0-9]{6,20}$'),
  customer_user_id text check (customer_user_id is null or length(customer_user_id) <= 140),
  delivery text check (delivery is null or delivery in ('sitio', 'llevar', 'domicilio')),
  address text check (address is null or length(address) <= 300),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  notes text check (notes is null or length(notes) <= 300),
  details text check (details is null or length(details) <= 1000),
  -- [{ menu_item_id, name, quantity, price_cents }]
  items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 50),
  -- De referencia, como en el mensaje de la carta: quien cobra es el local.
  total_cents integer check (total_cents is null or total_cents >= 0),
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  -- El mensaje que puso en pantalla la confirmacion de este pedido. Cada
  -- mensaje del cliente llega en su propio aviso y se atiende por separado,
  -- asi que dos "Confirmar" tocados seguidos leen el mismo estado a la vez:
  -- los dos traen esta misma clave, y el indice de abajo deja pasar uno.
  confirmation_key text check (confirmation_key is null or length(confirmation_key) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_con_cliente
    check (customer_phone is not null or customer_user_id is not null),
  constraint orders_con_algo
    check (jsonb_array_length(items) > 0 or details is not null),
  constraint orders_domicilio_con_direccion
    check (delivery is distinct from 'domicilio' or address is not null or lat is not null),
  constraint orders_coordenadas_juntas
    check ((lat is null) = (lng is null)),
  unique (restaurant_id, code)
);

comment on table public.orders is
  'Pedidos que llegan por el asistente de WhatsApp. Los escribe la llave de servicio; el dueno los lee y cambia su estado con cambiar_estado_pedido().';

create index orders_restaurant_idx on public.orders (restaurant_id, created_at desc);

create unique index orders_una_confirmacion_idx
  on public.orders (restaurant_id, confirmation_key)
  where confirmation_key is not null;

create trigger orders_touch
  before update on public.orders
  for each row execute function public.touch_updated_at();

alter table public.orders enable row level security;

create policy orders_select_own on public.orders
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

-- El dueno mueve el pedido hacia adelante —aceptado, listo, entregado— o lo
-- cancela mientras no se haya entregado. No hay politica de update: la
-- columna que cambia y hacia donde lo decide esta funcion, y devuelve lo que
-- la accion necesita para avisarle al cliente.
create function public.cambiar_estado_pedido(p_order uuid, p_status text)
returns table (
  id uuid,
  restaurant_id uuid,
  code text,
  status text,
  delivery text,
  customer_name text,
  customer_phone text,
  customer_user_id text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  rid uuid;
  antes text;
begin
  select o.restaurant_id, o.status into rid, antes
  from public.orders o
  where o.id = p_order
  for update;

  if rid is null then
    raise exception 'pedido_no_existe' using errcode = 'no_data_found';
  end if;
  if not public.owns_restaurant(rid) then
    raise exception 'solo_el_dueno' using errcode = 'insufficient_privilege';
  end if;
  if not (
    (antes = 'nuevo' and p_status in ('aceptado', 'cancelado'))
    or (antes = 'aceptado' and p_status in ('listo', 'cancelado'))
    or (antes = 'listo' and p_status in ('entregado', 'cancelado'))
  ) then
    raise exception 'cambio_no_permitido' using errcode = 'check_violation';
  end if;

  return query
  update public.orders o
  set status = p_status, status_at = now()
  where o.id = p_order
  returning o.id, o.restaurant_id, o.code, o.status, o.delivery,
            o.customer_name, o.customer_phone, o.customer_user_id;
end;
$$;

revoke execute on function public.cambiar_estado_pedido(uuid, text) from public, anon;
grant execute on function public.cambiar_estado_pedido(uuid, text) to authenticated;

-- 5. El aviso al dueno. Reusa la bandeja y el push que ya existen: un pedido
--    nuevo es un tipo de aviso mas, que cuelga del pedido.
alter table public.notifications
  drop constraint notifications_kind_check,
  add constraint notifications_kind_check
    check (kind in ('historia', 'resena', 'respuesta', 'insignia', 'pedido')),
  add column order_id uuid references public.orders (id) on delete cascade,
  add constraint notifications_pedido_con_pedido
    check ((kind = 'pedido') = (order_id is not null));

create index notifications_order_idx on public.notifications (order_id);

create unique index notifications_sin_repetir_pedido
  on public.notifications (profile_id, order_id)
  where order_id is not null;

create function public.avisar_de_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dueno uuid;
begin
  select owner_id into dueno from public.restaurants where id = new.restaurant_id;
  if dueno is not null then
    insert into public.notifications (profile_id, kind, order_id, restaurant_id)
    values (dueno, 'pedido', new.id, new.restaurant_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.avisar_de_pedido() from public, anon, authenticated;

create trigger orders_avisar_al_dueno
  after insert on public.orders
  for each row execute function public.avisar_de_pedido();

comment on column public.profiles.push_prefs is
  'Por tipo de aviso (historia, resena, respuesta, insignia, pedido): false = no mandar por push. La llave ausente cuenta como true.';
