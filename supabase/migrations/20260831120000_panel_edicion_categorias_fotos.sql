-- Lo que el panel necesitaba para que un dueno pueda terminar su ficha:
-- categorias que faltaban, categorias propias, y un lugar donde vivan las
-- fotos del restaurante.

-- 1. Faltaban categorias comunes. BBQ era la que mas se pedia.
insert into public.cuisines (slug, name) values
  ('bbq', 'BBQ y ahumados'),
  ('cortes', 'Cortes y steakhouse'),
  ('coreana', 'Coreana'),
  ('arabe', 'Arabe y libanesa'),
  ('espanola', 'Espanola y tapas'),
  ('peruana', 'Peruana'),
  ('argentina', 'Argentina'),
  ('india', 'India'),
  ('thai', 'Thai'),
  ('bar', 'Bar y cerveceria'),
  ('saludable', 'Saludable y bowls'),
  ('sin-gluten', 'Sin gluten')
on conflict (slug) do nothing;

-- 2. El catalogo deja de ser cerrado: si a alguien le falta su categoria, la
--    agrega. Sigue siendo un catalogo (una fila por categoria, compartida)
--    y no texto libre por restaurante, asi que el filtro de busqueda no se
--    rompe: 'BBQ' y 'bbq' siguen resolviendo al mismo slug.
alter table public.cuisines
  add column created_by uuid references public.profiles (id) on delete set null;

comment on column public.cuisines.created_by is
  'Nulo = categoria del catalogo original. Con valor = la propuso un dueno desde el panel.';

-- Solo puede crear categorias quien ya tiene un restaurante a su nombre: eso
-- corta el spam sin necesitar moderacion previa.
create policy cuisines_insert_owner on public.cuisines
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.restaurants
      where owner_id = (select auth.uid())
    )
  );

-- 3. Fotos. El bucket es publico de lectura porque una ficha publicada
--    muestra sus fotos a cualquiera; escribir sigue siendo del dueno.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurantes',
  'restaurantes',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- La ruta es '<restaurant_id>/<archivo>': la primera carpeta dice de quien es
-- el archivo, y owns_restaurant resuelve el permiso con esa carpeta.
create policy media_objects_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'restaurantes');

create policy media_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'restaurantes'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy media_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'restaurantes'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'restaurantes'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy media_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'restaurantes'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );
