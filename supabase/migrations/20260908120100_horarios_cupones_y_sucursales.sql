-- Cuatro cosas que el panel pedía y la base no sabía todavía:
--
--   1. A qué hora se sirve cada carta. Un restaurante no tiene "el menú":
--      tiene el de desayuno hasta mediodía y el de la cena a partir de las
--      siete, y hasta ahora los dos se veían iguales en la ficha.
--   2. Cuál es la carta principal: la que abre el QR y la que la ficha pone
--      primero.
--   3. Cupones con código, para que una promoción se pueda medir y no solo
--      anunciar.
--   4. Copiar una carta —o una historia— de una sucursal a otra sin volver a
--      capturarla.

-- ---------------------------------------------------------------------------
-- 1. El horario de cada carta
-- ---------------------------------------------------------------------------

-- Lista cerrada en texto y no un enum, por lo mismo que `template`: agregar
-- "brunch" mañana es una migración de una línea y no tocar un tipo.
alter table public.menus
  add column if not exists service_time text not null default 'siempre',
  add column if not exists serves_from time,
  add column if not exists serves_to time;

alter table public.menus drop constraint if exists menus_service_time_check;
alter table public.menus add constraint menus_service_time_check
  check (service_time in (
    'siempre',
    'desayuno',
    'brunch',
    'comida',
    'merienda',
    'happy_hour',
    'cena',
    'noche',
    'fin_de_semana'
  ));

comment on column public.menus.service_time is
  'Franja en la que se sirve la carta. "siempre" es todo el día, que es lo normal.';
comment on column public.menus.serves_from is
  'Hora a la que empieza a servirse, en la zona del local. Nulo = la de la franja.';
comment on column public.menus.serves_to is
  'Hora a la que deja de servirse. Nulo = la de la franja. Puede ser menor que serves_from: la carta de la noche cruza la medianoche.';

-- ---------------------------------------------------------------------------
-- 2. La carta principal
-- ---------------------------------------------------------------------------

alter table public.menus
  add column if not exists is_primary boolean not null default false;

comment on column public.menus.is_primary is
  'La carta que la ficha pone primero. Como mucho una por restaurante.';

-- Que sea una sola lo garantiza el índice; el trigger es lo que hace que
-- marcar la nueva desmarque la anterior en vez de reventar.
create unique index if not exists menus_principal_unico
  on public.menus (restaurant_id) where is_primary;

create or replace function public.menu_principal_unico()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_primary then
    -- Va antes de escribir la fila, así que el índice único nunca llega a ver
    -- dos. El update de abajo vuelve a disparar este trigger con is_primary
    -- en false, que no hace nada: no hay recursión.
    update public.menus
      set is_primary = false
      where restaurant_id = new.restaurant_id
        and id <> new.id
        and is_primary;
  end if;
  return new;
end;
$$;

drop trigger if exists menus_principal_unico on public.menus;
create trigger menus_principal_unico
  before insert or update of is_primary on public.menus
  for each row execute function public.menu_principal_unico();

-- Quien ya tiene cartas se queda con la primera como principal: sin esto la
-- ficha de todos los restaurantes de hoy no tendría ninguna marcada.
update public.menus m
set is_primary = true
where not exists (
  select 1 from public.menus o
  where o.restaurant_id = m.restaurant_id and o.is_primary
)
and m.id = (
  select o.id from public.menus o
  where o.restaurant_id = m.restaurant_id
  order by o.position, o.created_at
  limit 1
);

-- ---------------------------------------------------------------------------
-- 3. Favoritos contados, como los seguidores
-- ---------------------------------------------------------------------------

-- `favorites` es privada —solo cada quien ve la suya— así que el dueño no
-- puede contarla con un count(*): la RLS le devolvería cero. El total va en
-- una columna que lleva un trigger, igual que followers_count.
alter table public.restaurants
  add column if not exists favorites_count integer not null default 0;

comment on column public.restaurants.favorites_count is
  'Cuántas personas guardaron la ficha. Lo lleva un trigger sobre favorites.';

create or replace function public.contar_favoritos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.restaurants
      set favorites_count = favorites_count + 1
      where id = new.restaurant_id;
  elsif tg_op = 'DELETE' then
    update public.restaurants
      set favorites_count = greatest(favorites_count - 1, 0)
      where id = old.restaurant_id;
  end if;
  return null;
end;
$$;

drop trigger if exists favorites_conteo on public.favorites;
create trigger favorites_conteo
  after insert or delete on public.favorites
  for each row execute function public.contar_favoritos();

-- Lo que ya estaba guardado antes del contador.
update public.restaurants r
set favorites_count = coalesce((
  select count(*) from public.favorites f where f.restaurant_id = r.id
), 0);

-- ---------------------------------------------------------------------------
-- 4. Cupones
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'coupon_kind') then
    create type public.coupon_kind as enum ('porcentaje', 'monto', '2x1', 'regalo');
  end if;
end
$$;

comment on type public.coupon_kind is
  'porcentaje = 15% de descuento. monto = $50 menos. 2x1 y regalo no llevan cifra.';

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- El código es lo que el comensal dice en la caja. Se guarda como lo
  -- escribió el dueño y se compara sin distinguir mayúsculas.
  code text not null check (code ~ '^[A-Za-z0-9]{3,16}$'),
  title text not null check (length(btrim(title)) between 1 and 80),
  description text check (length(description) <= 300),
  terms text check (length(terms) <= 300),
  kind public.coupon_kind not null default 'porcentaje',
  -- Porcentaje entero (15) o centavos (5000). Nulo en 2x1 y regalo.
  value_int integer check (value_int is null or value_int >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  -- Nulo = sin tope. El tope lo hace válido para las primeras N mesas.
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemptions_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_vigencia check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint coupons_cifra check (
    (kind in ('porcentaje', 'monto') and value_int is not null)
    or (kind in ('2x1', 'regalo'))
  ),
  constraint coupons_porcentaje check (kind <> 'porcentaje' or value_int between 1 and 100)
);

comment on table public.coupons is
  'Cupones con código de cada restaurante. Se ven en la ficha y se canjean en la caja.';

create unique index if not exists coupons_codigo_unico
  on public.coupons (restaurant_id, upper(code));

create index if not exists coupons_restaurant_idx
  on public.coupons (restaurant_id, created_at desc);

drop trigger if exists coupons_touch on public.coupons;
create trigger coupons_touch
  before update on public.coupons
  for each row execute function public.touch_updated_at();

-- Un cupón está vivo si está encendido, dentro de fechas y no se acabó. La
-- regla vive en una función porque la usan la política de lectura, la ficha y
-- el canje, y las tres tienen que decir lo mismo.
create or replace function public.coupon_vigente(c public.coupons)
returns boolean
language sql
stable
as $$
  select c.is_active
     and (c.starts_at is null or c.starts_at <= now())
     and (c.ends_at is null or c.ends_at > now())
     and (c.max_redemptions is null or c.redemptions_count < c.max_redemptions);
$$;

alter table public.coupons enable row level security;

-- Los vigentes de una ficha publicada los ve cualquiera: son lo que se enseña
-- en la ficha. Los suyos, el dueño, vigentes o no.
drop policy if exists coupons_select on public.coupons;
create policy coupons_select on public.coupons
  for select to anon, authenticated
  using (
    (public.restaurant_is_public(restaurant_id) and public.coupon_vigente(coupons))
    or public.owns_restaurant(restaurant_id)
  );

drop policy if exists coupons_insert on public.coupons;
create policy coupons_insert on public.coupons
  for insert to authenticated
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists coupons_update on public.coupons;
create policy coupons_update on public.coupons
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists coupons_delete on public.coupons;
create policy coupons_delete on public.coupons
  for delete to authenticated
  using (public.owns_restaurant(restaurant_id));

-- El canje: lo registra el dueño cuando alguien dice el código en la caja. Es
-- la mitad que convierte "lo vieron" en "vinieron", que es toda la gracia de
-- que el cupón tenga código.
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  note text check (length(note) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists coupon_redemptions_coupon_idx
  on public.coupon_redemptions (coupon_id, created_at desc);
create index if not exists coupon_redemptions_restaurant_idx
  on public.coupon_redemptions (restaurant_id, created_at desc);

alter table public.coupon_redemptions enable row level security;

drop policy if exists coupon_redemptions_select on public.coupon_redemptions;
create policy coupon_redemptions_select on public.coupon_redemptions
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

drop policy if exists coupon_redemptions_insert on public.coupon_redemptions;
create policy coupon_redemptions_insert on public.coupon_redemptions
  for insert to authenticated
  with check (public.owns_restaurant(restaurant_id));

drop policy if exists coupon_redemptions_delete on public.coupon_redemptions;
create policy coupon_redemptions_delete on public.coupon_redemptions
  for delete to authenticated
  using (public.owns_restaurant(restaurant_id));

create or replace function public.contar_canjes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.coupons
      set redemptions_count = redemptions_count + 1
      where id = new.coupon_id;
  elsif tg_op = 'DELETE' then
    update public.coupons
      set redemptions_count = greatest(redemptions_count - 1, 0)
      where id = old.coupon_id;
  end if;
  return null;
end;
$$;

drop trigger if exists coupon_redemptions_conteo on public.coupon_redemptions;
create trigger coupon_redemptions_conteo
  after insert or delete on public.coupon_redemptions
  for each row execute function public.contar_canjes();

-- ---------------------------------------------------------------------------
-- 5. Los eventos de cupón, en la tabla de siempre
-- ---------------------------------------------------------------------------

alter table public.restaurant_events
  add column if not exists coupon_id uuid references public.coupons (id) on delete set null;

comment on column public.restaurant_events.coupon_id is
  'El cupón en el que ocurrió el evento. Nulo en todo lo demás.';

-- El índice que evita contar diez veces a quien recarga tiene que crecer con
-- la columna, por lo mismo que creció con menu_id: sin ella, ver dos cupones
-- en la misma hora sería un solo evento.
drop index if exists public.restaurant_events_sin_repetir;
create unique index restaurant_events_sin_repetir
  on public.restaurant_events (
    restaurant_id,
    visitor,
    event,
    hora,
    coalesce(menu_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(coupon_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists restaurant_events_cupon_idx
  on public.restaurant_events (restaurant_id, coupon_id, event, created_at desc)
  where coupon_id is not null;

-- Que el cupón sea de esa ficha se comprueba en la base y no solo en la ruta
-- que recibe los eventos, igual que con las cartas.
create or replace function public.cupon_es_de_la_ficha(cupon uuid, ficha uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coupons c
    where c.id = cupon and c.restaurant_id = ficha
  );
$$;

revoke all on function public.cupon_es_de_la_ficha(uuid, uuid) from public;
grant execute on function public.cupon_es_de_la_ficha(uuid, uuid) to anon, authenticated;

drop policy if exists restaurant_events_insert_publicos on public.restaurant_events;
create policy restaurant_events_insert_publicos on public.restaurant_events
  for insert to anon, authenticated
  with check (
    public.restaurant_is_public(restaurant_id)
    and (menu_id is null or public.menu_es_de_la_ficha(menu_id, restaurant_id))
    and (coupon_id is null or public.cupon_es_de_la_ficha(coupon_id, restaurant_id))
  );

-- ---------------------------------------------------------------------------
-- 6. Copiar entre sucursales
-- ---------------------------------------------------------------------------

-- Duplicar una carta es copiar tres tablas con los ids remapeados. Va en la
-- base y no en el servidor de la aplicación porque así es una sola
-- transacción: una carta a medio copiar es peor que ninguna.
--
-- El destino puede ser el mismo restaurante (duplicar la carta para hacerle
-- cambios) u otra sucursal del mismo dueño. El límite del plan del destino lo
-- sigue poniendo su propio trigger.
create or replace function public.duplicar_menu(
  p_menu uuid,
  p_destino uuid,
  p_nombre text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  origen public.menus%rowtype;
  nuevo_id uuid;
  nombre text;
  siguiente smallint;
  seccion public.menu_sections%rowtype;
  nueva_seccion uuid;
begin
  select * into origen from public.menus where id = p_menu;
  if not found then
    raise exception 'Esa carta no existe.' using errcode = 'P0002';
  end if;

  -- Las dos puntas tienen que ser del mismo dueño: la de origen para poder
  -- leerla y la de destino para poder escribir en ella.
  if not public.owns_restaurant(origen.restaurant_id) or not public.owns_restaurant(p_destino) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  nombre := coalesce(
    nullif(btrim(p_nombre), ''),
    case when p_destino = origen.restaurant_id then left(origen.name || ' (copia)', 60)
         else origen.name end
  );

  select coalesce(max(position) + 1, 0) into siguiente
  from public.menus where restaurant_id = p_destino;

  insert into public.menus (
    restaurant_id, name, description, kind, template, style,
    file_path, file_mime, service_time, serves_from, serves_to,
    -- La copia nunca nace visible ni nace principal: el dueño la revisa antes
    -- de que la vea nadie, y la sucursal destino ya tiene su propia principal.
    is_visible, is_primary, position
  )
  values (
    p_destino, nombre, origen.description, origen.kind, origen.template, origen.style,
    origen.file_path, origen.file_mime, origen.service_time, origen.serves_from, origen.serves_to,
    false, false, siguiente
  )
  returning id into nuevo_id;

  -- Las secciones se copian una por una en vez de con un solo insert: hace
  -- falta el id nuevo de cada una para que sus platillos caigan donde iban, y
  -- casar dos listas por su orden después es más frágil que recorrerlas.
  for seccion in
    select * from public.menu_sections
    where menu_id = p_menu
    order by position, created_at
  loop
    insert into public.menu_sections (restaurant_id, menu_id, name, position)
    values (p_destino, nuevo_id, seccion.name, seccion.position)
    returning id into nueva_seccion;

    insert into public.menu_items (
      restaurant_id, menu_id, section_id, name, description,
      price_cents, currency, photo_path, icon, labels, is_available, position
    )
    select p_destino, nuevo_id, nueva_seccion, i.name, i.description,
           i.price_cents, i.currency, i.photo_path, i.icon, i.labels,
           i.is_available, i.position
    from public.menu_items i
    where i.menu_id = p_menu and i.section_id = seccion.id;
  end loop;

  -- Los platillos sin sección viajan igual: en la carta salen en su propio
  -- grupo al final, y perderlos en la copia sería perder platillos.
  insert into public.menu_items (
    restaurant_id, menu_id, section_id, name, description,
    price_cents, currency, photo_path, icon, labels, is_available, position
  )
  select p_destino, nuevo_id, null, i.name, i.description,
         i.price_cents, i.currency, i.photo_path, i.icon, i.labels,
         i.is_available, i.position
  from public.menu_items i
  where i.menu_id = p_menu and i.section_id is null;

  return nuevo_id;
end;
$$;

comment on function public.duplicar_menu(uuid, uuid, text) is
  'Copia una carta entera —secciones y platillos— al restaurante destino, que tiene que ser del mismo dueño. La copia nace oculta.';

revoke all on function public.duplicar_menu(uuid, uuid, text) from public;
grant execute on function public.duplicar_menu(uuid, uuid, text) to authenticated;

-- Las sucursales del dueño de un restaurante: lo que llena el selector de
-- "copiar a…". No es `owner_id = auth.uid()` a secas para que la lista sea la
-- del dueño de esa ficha y no la de quien pregunta.
create or replace function public.mis_sucursales(rid uuid)
returns table (id uuid, name text, city text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name, r.city, r.slug
  from public.restaurants r
  where public.owns_restaurant(rid)
    and r.owner_id = (select auth.uid())
  order by r.name;
$$;

revoke all on function public.mis_sucursales(uuid) from public;
grant execute on function public.mis_sucursales(uuid) to authenticated;
