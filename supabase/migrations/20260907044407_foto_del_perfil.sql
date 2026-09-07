-- La foto de la cuenta.
--
-- Hasta ahora el avatar era un dibujo igual para todos. Quien entra con dos
-- correos —el suyo y el del negocio— no distinguía uno de otro de un vistazo,
-- y el correo escrito en la barra ya no está para decirlo.
--
-- Vale para comensales y para dueños: es de la cuenta, no del restaurante.

alter table public.profiles
  add column if not exists avatar_path text;

comment on column public.profiles.avatar_path is
  'Ruta en el bucket "avatares" de la foto de la cuenta. Null: se dibuja el icono.';

-- ---------------------------------------------------------------------------
-- El bucket
-- ---------------------------------------------------------------------------
-- Aparte del de fotos de restaurantes porque el permiso es otro: aquí la
-- carpeta es la persona y no el local. Dos megas bastan para una foto que se
-- ve a 32 píxeles, y el tope corta en el servidor lo que el navegador deje
-- pasar. Público de lectura: el avatar sale junto a las reseñas, que son
-- páginas públicas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares',
  'avatares',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- La ruta es '<user_id>/<archivo>': la primera carpeta es de donde sale el
-- permiso, igual que en los otros buckets.
create policy avatares_objects_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatares');

create policy avatares_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatares_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatares_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
