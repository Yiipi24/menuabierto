-- Guardar un restaurante para después. Quien busca dónde comer casi nunca
-- decide en la primera pasada: abre cuatro fichas, compara precios y vuelve.
-- Sin un lugar donde apartarlos, esa comparación se hace con pestañas.
--
-- La tabla es a propósito mínima —quién y cuál— porque un favorito no tiene
-- estados ni notas: o está guardado o no. La llave primaria compuesta hace
-- que guardar dos veces no pueda duplicar nada, y el borrado en cascada
-- limpia solo cuando se va la persona o la ficha.
create table public.favorites (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, restaurant_id)
);

comment on table public.favorites is
  'Restaurantes que una persona guardó. Privados: nadie más los ve.';

-- La clave primaria ya ordena por persona, que es como se leen ("mis
-- guardados"). El índice extra es para el camino contrario: contar o limpiar
-- los favoritos de una ficha sin recorrer la tabla entera.
create index favorites_restaurant_idx on public.favorites (restaurant_id);

alter table public.favorites enable row level security;

-- Un favorito es privado, y esa es toda la política: ni el dueño del
-- restaurante ni nadie más puede leer quién lo guardó. Si algún día se enseña
-- "1.2k guardados" en la ficha, eso será un contador agregado, no esta tabla
-- abierta.
create policy favorites_select_own on public.favorites
  for select to authenticated using (profile_id = (select auth.uid()));

-- Solo se puede guardar una ficha que de verdad se puede ver: sin esto, la
-- tabla serviría para adivinar los ids de las fichas en borrador.
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.restaurant_is_public(restaurant_id)
  );

create policy favorites_delete_own on public.favorites
  for delete to authenticated using (profile_id = (select auth.uid()));
