-- Helper: la persona autenticada controla este restaurante?
-- security definer para que pueda leer restaurants sin quedar atrapado en la
-- propia RLS de la tabla que esta autorizando.
create function public.owns_restaurant(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurants
    where id = target and owner_id = auth.uid()
  );
$$;

create function public.restaurant_is_public(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurants
    where id = target and status = 'publicado'
  );
$$;

alter table public.profiles enable row level security;
alter table public.cuisines enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_cuisines enable row level security;
alter table public.restaurant_hours enable row level security;
alter table public.menu_sections enable row level security;
alter table public.menu_items enable row level security;
alter table public.restaurant_media enable row level security;
alter table public.reviews enable row level security;
alter table public.restaurant_claims enable row level security;

-- Perfiles: cada quien ve y edita el suyo. No son publicos: el directorio
-- muestra restaurantes, no personas.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- El catalogo de tipos de comida lo lee cualquiera; solo se edita por consola.
create policy cuisines_select_all on public.cuisines
  for select to anon, authenticated using (true);

-- Restaurantes: el mundo ve los publicados. El dueno ve tambien sus
-- borradores y fichas ocultas.
create policy restaurants_select_published on public.restaurants
  for select to anon, authenticated using (status = 'publicado');
create policy restaurants_select_own on public.restaurants
  for select to authenticated using (owner_id = auth.uid());

-- Al registrarse, un dueno crea su ficha ya reclamada a su nombre.
create policy restaurants_insert_own on public.restaurants
  for insert to authenticated
  with check (owner_id = auth.uid() and created_by = auth.uid());

create policy restaurants_update_own on public.restaurants
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy restaurants_delete_own on public.restaurants
  for delete to authenticated using (owner_id = auth.uid());

-- Tablas hijas: se leen si el restaurante es publico, se editan si es tuyo.
create policy cuisines_link_select on public.restaurant_cuisines
  for select to anon, authenticated
  using (public.restaurant_is_public(restaurant_id) or public.owns_restaurant(restaurant_id));
create policy cuisines_link_write on public.restaurant_cuisines
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy hours_select on public.restaurant_hours
  for select to anon, authenticated
  using (public.restaurant_is_public(restaurant_id) or public.owns_restaurant(restaurant_id));
create policy hours_write on public.restaurant_hours
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy sections_select on public.menu_sections
  for select to anon, authenticated
  using (public.restaurant_is_public(restaurant_id) or public.owns_restaurant(restaurant_id));
create policy sections_write on public.menu_sections
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy items_select on public.menu_items
  for select to anon, authenticated
  using (public.restaurant_is_public(restaurant_id) or public.owns_restaurant(restaurant_id));
create policy items_write on public.menu_items
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy media_select on public.restaurant_media
  for select to anon, authenticated
  using (public.restaurant_is_public(restaurant_id) or public.owns_restaurant(restaurant_id));
create policy media_write on public.restaurant_media
  for all to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

-- Resenas: publicas de leer; cada quien escribe y edita la suya. El dueno no
-- puede borrar las resenas de su propio restaurante, que es justo el punto.
create policy reviews_select on public.reviews
  for select to anon, authenticated using (public.restaurant_is_public(restaurant_id));
create policy reviews_insert_own on public.reviews
  for insert to authenticated with check (author_id = auth.uid());
create policy reviews_update_own on public.reviews
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy reviews_delete_own on public.reviews
  for delete to authenticated using (author_id = auth.uid());

-- Reclamos: cada quien ve y crea los suyos. Aprobarlos es tarea del equipo
-- desde la consola, nunca del propio solicitante.
create policy claims_select_own on public.restaurant_claims
  for select to authenticated using (claimant_id = auth.uid());
create policy claims_insert_own on public.restaurant_claims
  for insert to authenticated
  with check (claimant_id = auth.uid() and status = 'pendiente');
