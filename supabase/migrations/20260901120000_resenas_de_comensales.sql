-- Las resenas ya existian como tabla, pero nadie podia escribir una: la ficha
-- publica no tenia formulario. Al abrirlo hay que cerrar tres huecos que hasta
-- ahora no importaban porque la tabla estaba vacia.

-- 1. Un texto sin tope deja que una sola resena pese megabytes y reviente la
--    ficha al renderizarla. Mil quinientos caracteres son de sobra para contar
--    una comida.
alter table public.reviews
  add constraint reviews_body_largo
  check (body is null or length(body) <= 1500);

-- 2. Quien escribe manda author_id, pero eso no basta:
--    - Un borrador no se resena. Su ficha no es visible, asi que la resena
--      viviria a ciegas y apareceria de golpe el dia que se publique.
--    - El dueno no se califica a si mismo. Es el unico limite que hace que un
--      promedio signifique algo.
--    El USING del update se queda solo con la autoria: si un dueno reclama la
--    ficha despues de haberla resenado como comensal, tiene que poder borrar
--    la suya aunque ya no pueda editarla.
drop policy reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.restaurant_is_public(restaurant_id)
    and not public.owns_restaurant(restaurant_id)
  );

drop policy reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and public.restaurant_is_public(restaurant_id)
    and not public.owns_restaurant(restaurant_id)
  );

-- 3. La lista sale ordenada por fecha; el indice plano por restaurante obligaba
--    a ordenar en memoria.
drop index public.reviews_restaurant_idx;
create index reviews_restaurant_idx
  on public.reviews (restaurant_id, created_at desc);

-- Una resena firmada por "alguien" no vale nada, pero profiles es privado a
-- proposito: ahi vive el telefono. En vez de abrir la tabla, esta funcion
-- devuelve solo el nombre, y solo de restaurantes publicados.
create function public.resenas_restaurante(rid uuid)
returns table (
  id uuid,
  rating smallint,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  author_id uuid,
  author_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.rating,
    v.body,
    v.created_at,
    v.updated_at,
    v.author_id,
    coalesce(nullif(btrim(p.full_name), ''), 'Comensal')
  from public.reviews v
  join public.profiles p on p.id = v.author_id
  where v.restaurant_id = rid
    and public.restaurant_is_public(rid)
  order by v.created_at desc;
$$;

comment on function public.resenas_restaurante(uuid) is
  'Resenas publicas de un restaurante con el nombre de quien las escribio. Es security definer para leer profiles.full_name sin abrir el resto del perfil.';

revoke execute on function public.resenas_restaurante(uuid) from public;
grant execute on function public.resenas_restaurante(uuid) to anon, authenticated;
