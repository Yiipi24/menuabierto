-- El embudo del alta (#88): la primera vez que cada ficha da cada paso. Una
-- fila por ficha y paso, así que contar el embudo es un `group by paso`, y el
-- panel sabe si el dueño ya bajó su QR (lo único de la lista "Para publicar
-- tu ficha" que no se deduce de la ficha misma). El catálogo es el mismo que
-- PASOS_DEL_EMBUDO en lib/alta.js.
create table public.alta_pasos (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  paso text not null check (paso in ('alta_creada', 'menu_creado', 'qr_descargado', 'ficha_publicada')),
  created_at timestamptz not null default now(),
  primary key (restaurant_id, paso)
);

comment on table public.alta_pasos is
  'La primera vez que cada ficha dio cada paso del alta. Lo escriben las acciones del panel con la sesión del dueño; nunca se actualiza ni se borra.';

alter table public.alta_pasos enable row level security;

create policy alta_pasos_select on public.alta_pasos
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy alta_pasos_insert on public.alta_pasos
  for insert to authenticated
  with check (public.owns_restaurant(restaurant_id));

-- Solo leer y agregar, y solo el dueño: un paso dado no se deshace.
revoke all on table public.alta_pasos from anon, authenticated;
grant select, insert on table public.alta_pasos to authenticated;

-- Lo que ya pasó antes de esta tabla, deducido de las fichas con dueño. El QR
-- no deja rastro, así que ese paso empieza vacío.
insert into public.alta_pasos (restaurant_id, paso, created_at)
select r.id, 'alta_creada', r.created_at
from public.restaurants r
where r.owner_id is not null
on conflict do nothing;

insert into public.alta_pasos (restaurant_id, paso, created_at)
select m.restaurant_id, 'menu_creado', min(m.created_at)
from public.menus m
join public.restaurants r on r.id = m.restaurant_id
where r.owner_id is not null
group by m.restaurant_id
on conflict do nothing;

insert into public.alta_pasos (restaurant_id, paso, created_at)
select r.id, 'ficha_publicada', coalesce(r.claimed_at, r.updated_at)
from public.restaurants r
where r.owner_id is not null and r.status = 'publicado'
on conflict do nothing;
