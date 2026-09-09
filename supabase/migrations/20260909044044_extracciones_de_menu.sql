-- Cargar la carta desde una foto o un PDF.
--
-- Capturar sesenta platillos a mano es donde se pierde al dueno que ya se
-- registro. Un modelo de vision lee la foto y devuelve secciones, platillos y
-- precios; el dueno los revisa antes de que entren al menu. Cada lectura
-- cuesta dinero, asi que queda registrada: es lo que permite contar los
-- intentos del mes contra el cupo del plan.
create table public.menu_extractions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- Nulo si el menu se borro despues: el intento se sigue contando.
  menu_id uuid references public.menus (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- ok = devolvio platillos; ilegible = el modelo dijo que no se lee; error =
  -- fallo nuestro o de la API (no se cobra al cupo); aplicada = el dueno la
  -- reviso y la paso al menu.
  status text not null default 'ok'
    check (status in ('ok', 'ilegible', 'error', 'aplicada')),
  file_path text,
  file_mime text,
  model text,
  input_tokens integer,
  output_tokens integer,
  -- Lo que devolvio el modelo, ya normalizado. Es lo que la pantalla de
  -- revision enseña; nada de aqui llega a menu_items sin pasar por el dueno.
  result jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.menu_extractions is
  'Lecturas de una carta por un modelo de vision. Cuentan contra el cupo mensual del plan; el resultado solo entra al menu tras la revision del dueno.';

create index menu_extractions_restaurant_idx
  on public.menu_extractions (restaurant_id, created_at desc);
create index menu_extractions_menu_idx on public.menu_extractions (menu_id);
create index menu_extractions_created_by_idx on public.menu_extractions (created_by);

alter table public.menu_extractions enable row level security;

-- El dueno ve y registra las de sus fichas. No hay politica de delete a
-- proposito: borrar el registro seria reiniciar el contador del mes.
create policy menu_extractions_select_own on public.menu_extractions
  for select to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy menu_extractions_insert_own on public.menu_extractions
  for insert to authenticated
  with check (public.owns_restaurant(restaurant_id) and created_by = (select auth.uid()));

-- Solo para marcarla aplicada.
create policy menu_extractions_update_own on public.menu_extractions
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

-- Cuantas lecturas lleva la ficha este mes. Los errores nuestros no cuentan:
-- el dueno no pago nada por ellos.
create function public.extracciones_del_mes(rid uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.menu_extractions
  where restaurant_id = rid
    and status <> 'error'
    and created_at >= date_trunc('month', now());
$$;
