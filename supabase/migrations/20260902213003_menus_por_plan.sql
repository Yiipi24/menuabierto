-- Un restaurante no tiene "un menu": tiene la carta, la de bebidas, la del
-- dia, la de fin de semana. Hasta ahora las secciones y los platillos colgaban
-- del restaurante, asi que todo caia en una sola lista. Aqui aparece el menu
-- como cosa propia, con su nombre y su plantilla, y el plan dice cuantos
-- caben.

-- 1. Cuantos menus incluye cada plan. Vive en la base y no solo en el panel
--    porque el limite se tiene que sostener aunque alguien escriba contra la
--    API directamente.
create function public.menus_incluidos(rid uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    -- Un plan de paga vencido vuelve a basico solo. Si no, bastaria con dejar
    -- de pagar para conservar los treinta menus para siempre.
    when r.plan = 'basico' then 5
    when r.premium_until is not null and r.premium_until <= now() then 5
    when r.plan = 'plus' then 10
    when r.plan = 'premium' then 30
    else 5
  end
  from public.restaurants r
  where r.id = rid;
$$;

comment on function public.menus_incluidos(uuid) is
  'Menus que caben en el plan vigente del restaurante: 5 basico, 10 plus, 30 premium.';

-- 2. El menu.
create type public.menu_kind as enum ('digital', 'archivo');

comment on type public.menu_kind is
  'digital = capturado plato por plato. archivo = el PDF o la foto que subio el dueno.';

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  kind public.menu_kind not null default 'digital',
  -- La plantilla es texto con lista cerrada y no un enum: agregar un diseno
  -- nuevo es una migracion de una linea en vez de tocar un tipo.
  template text not null default 'clasica'
    check (template in ('clasica', 'pizarra', 'elegante', 'compacta')),
  -- Ruta dentro del bucket 'menus', no una URL: mismo criterio que las fotos.
  file_path text,
  file_mime text,
  -- Oculto sirve para preparar la carta de temporada sin publicarla todavia.
  is_visible boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sirve de destino a la llave compuesta de secciones y platillos: con ella
  -- una seccion no puede colgar del menu de otro restaurante.
  unique (id, restaurant_id)
);

comment on column public.menus.file_path is
  'Solo en los menus de tipo archivo. Ruta "<restaurant_id>/<archivo>" en el bucket menus.';

create index menus_restaurant_idx on public.menus (restaurant_id, position);

create trigger menus_touch
  before update on public.menus
  for each row execute function public.touch_updated_at();

-- 3. Secciones y platillos pasan a colgar de un menu.
alter table public.menu_sections add column menu_id uuid;
alter table public.menu_items add column menu_id uuid;

-- Lo que ya existia era, de hecho, la carta principal de cada restaurante.
insert into public.menus (restaurant_id, name, kind, template, position)
select restaurant_id, 'Menu principal', 'digital', 'clasica', 0
from (
  select restaurant_id from public.menu_sections
  union
  select restaurant_id from public.menu_items
) con_carta;

update public.menu_sections s
set menu_id = m.id
from public.menus m
where m.restaurant_id = s.restaurant_id and s.menu_id is null;

update public.menu_items i
set menu_id = m.id
from public.menus m
where m.restaurant_id = i.restaurant_id and i.menu_id is null;

alter table public.menu_sections alter column menu_id set not null;
alter table public.menu_items alter column menu_id set not null;

alter table public.menu_sections
  add constraint menu_sections_menu_fkey
  foreign key (menu_id, restaurant_id)
  references public.menus (id, restaurant_id) on delete cascade;

alter table public.menu_items
  add constraint menu_items_menu_fkey
  foreign key (menu_id, restaurant_id)
  references public.menus (id, restaurant_id) on delete cascade;

create index menu_sections_menu_idx on public.menu_sections (menu_id, position);
create index menu_items_menu_idx on public.menu_items (menu_id, position);

-- section_id sigue con "on delete set null" a proposito: borrar la seccion
-- "Entradas" no debe borrar sus platillos, los deja sin agrupar. Por eso la
-- coherencia entre platillo y seccion no puede ser una llave compuesta (al
-- borrar pondria en nulo tambien menu_id, que es obligatorio) y se comprueba
-- aqui.
create function public.menu_item_seccion_coherente()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.section_id is not null and not exists (
    select 1 from public.menu_sections s
    where s.id = new.section_id and s.menu_id = new.menu_id
  ) then
    raise exception 'La seccion no pertenece a ese menu.';
  end if;
  return new;
end;
$$;

create trigger menu_items_seccion_coherente
  before insert or update of section_id, menu_id on public.menu_items
  for each row execute function public.menu_item_seccion_coherente();

-- 4. El limite del plan, en la base.
create function public.menus_dentro_del_plan()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  limite integer;
  usados integer;
begin
  -- Sin el candado, dos altas a la vez leen el mismo conteo y las dos pasan.
  -- Es por restaurante, asi que no estorba a nadie mas.
  perform pg_advisory_xact_lock(hashtext(new.restaurant_id::text));

  limite := public.menus_incluidos(new.restaurant_id);
  if limite is null then
    return new;
  end if;

  select count(*) into usados
  from public.menus
  where restaurant_id = new.restaurant_id;

  if usados >= limite then
    raise exception 'limite_de_menus: el plan incluye % menus', limite
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger menus_limite_del_plan
  before insert on public.menus
  for each row execute function public.menus_dentro_del_plan();

-- 5. RLS. Se ve el menu de una ficha publicada o el propio; escribe el dueno.
alter table public.menus enable row level security;

create policy menus_select on public.menus
  for select to anon, authenticated
  using (
    public.restaurant_is_public(restaurant_id)
    or public.owns_restaurant(restaurant_id)
  );

create policy menus_insert on public.menus
  for insert to authenticated
  with check (public.owns_restaurant(restaurant_id));

create policy menus_update on public.menus
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy menus_delete on public.menus
  for delete to authenticated
  using (public.owns_restaurant(restaurant_id));

-- 6. Donde viven los menus subidos. Bucket aparte del de fotos porque este
--    acepta PDF y aquel no, y el limite de tamano es otro.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menus',
  'menus',
  true,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy menus_objects_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'menus');

create policy menus_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menus'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy menus_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'menus'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'menus'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy menus_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menus'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );
