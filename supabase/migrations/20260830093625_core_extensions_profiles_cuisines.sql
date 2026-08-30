create extension if not exists postgis;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- Perfil publico ligado a la cuenta de auth. Guardamos aqui lo que la app
-- necesita mostrar; el correo y la contrasena viven en auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Datos publicos de cada cuenta. Se crea sola al registrarse un usuario.';

-- Crear el perfil desde un trigger evita que la app tenga que acordarse de
-- hacerlo, y que una cuenta quede sin perfil si el registro falla a medias.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantener updated_at al dia sin depender de que la app lo mande.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Catalogo cerrado de tipos de comida. Es un catalogo y no texto libre para
-- que el filtro de busqueda sea confiable: 'tacos' y 'Taqueria' no pueden
-- convertirse en dos categorias distintas.
create table public.cuisines (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null
);

insert into public.cuisines (slug, name) values
  ('tacos', 'Tacos'),
  ('mariscos', 'Mariscos'),
  ('comida-corrida', 'Comida corrida'),
  ('antojitos', 'Antojitos mexicanos'),
  ('parrilla', 'Carnes y parrilla'),
  ('pizza', 'Pizza'),
  ('hamburguesas', 'Hamburguesas'),
  ('sushi', 'Sushi y japonesa'),
  ('china', 'China'),
  ('italiana', 'Italiana'),
  ('vegetariana', 'Vegetariana y vegana'),
  ('desayunos', 'Desayunos y cafeteria'),
  ('postres', 'Postres y reposteria'),
  ('pollo', 'Pollo'),
  ('birria', 'Birria y barbacoa'),
  ('tortas', 'Tortas y sandwiches');
