-- 1. Las funciones de trigger no tienen por que ser invocables como RPC.
--    Revocar EXECUTE no afecta al trigger: el permiso se valida al crearlo.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.refresh_restaurant_rating() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

-- 2. auth.uid() dentro de una politica se reevalua en cada fila. Envuelto en
--    un subselect Postgres lo calcula una sola vez por consulta. Con pocas
--    filas da igual; con un directorio grande es la diferencia.
drop policy profiles_select_own on public.profiles;
drop policy profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 3. Dos politicas permisivas de SELECT obligan a evaluar ambas en cada
--    consulta. Se fusionan en una sola con OR.
drop policy restaurants_select_published on public.restaurants;
drop policy restaurants_select_own on public.restaurants;
create policy restaurants_select on public.restaurants
  for select to anon, authenticated
  using (status = 'publicado' or owner_id = (select auth.uid()));

drop policy restaurants_insert_own on public.restaurants;
drop policy restaurants_update_own on public.restaurants;
drop policy restaurants_delete_own on public.restaurants;
create policy restaurants_insert_own on public.restaurants
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and created_by = (select auth.uid()));
create policy restaurants_update_own on public.restaurants
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy restaurants_delete_own on public.restaurants
  for delete to authenticated using (owner_id = (select auth.uid()));

drop policy reviews_insert_own on public.reviews;
drop policy reviews_update_own on public.reviews;
drop policy reviews_delete_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy reviews_update_own on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy reviews_delete_own on public.reviews
  for delete to authenticated using (author_id = (select auth.uid()));

drop policy claims_select_own on public.restaurant_claims;
drop policy claims_insert_own on public.restaurant_claims;
create policy claims_select_own on public.restaurant_claims
  for select to authenticated using (claimant_id = (select auth.uid()));
create policy claims_insert_own on public.restaurant_claims
  for insert to authenticated
  with check (claimant_id = (select auth.uid()) and status = 'pendiente');

-- 4. Las tablas hijas usaban FOR ALL, que incluye SELECT y por eso chocaba
--    con su politica de lectura. Se separan las tres acciones de escritura.
drop policy cuisines_link_write on public.restaurant_cuisines;
create policy cuisines_link_insert on public.restaurant_cuisines
  for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy cuisines_link_update on public.restaurant_cuisines
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy cuisines_link_delete on public.restaurant_cuisines
  for delete to authenticated using (public.owns_restaurant(restaurant_id));

drop policy hours_write on public.restaurant_hours;
create policy hours_insert on public.restaurant_hours
  for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy hours_update on public.restaurant_hours
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy hours_delete on public.restaurant_hours
  for delete to authenticated using (public.owns_restaurant(restaurant_id));

drop policy sections_write on public.menu_sections;
create policy sections_insert on public.menu_sections
  for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy sections_update on public.menu_sections
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy sections_delete on public.menu_sections
  for delete to authenticated using (public.owns_restaurant(restaurant_id));

drop policy items_write on public.menu_items;
create policy items_insert on public.menu_items
  for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy items_update on public.menu_items
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy items_delete on public.menu_items
  for delete to authenticated using (public.owns_restaurant(restaurant_id));

drop policy media_write on public.restaurant_media;
create policy media_insert on public.restaurant_media
  for insert to authenticated with check (public.owns_restaurant(restaurant_id));
create policy media_update on public.restaurant_media
  for update to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));
create policy media_delete on public.restaurant_media
  for delete to authenticated using (public.owns_restaurant(restaurant_id));

-- 5. Indices en llaves foraneas: sin ellos, borrar un perfil o una seccion
--    obliga a recorrer la tabla hija entera.
create index menu_items_section_idx on public.menu_items (section_id);
create index restaurant_claims_claimant_idx on public.restaurant_claims (claimant_id);
create index restaurant_claims_resolved_by_idx on public.restaurant_claims (resolved_by);
create index restaurants_created_by_idx on public.restaurants (created_by);
create index reviews_author_idx on public.reviews (author_id);
