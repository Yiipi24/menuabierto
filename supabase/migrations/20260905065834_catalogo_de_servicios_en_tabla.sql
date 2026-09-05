-- El catálogo de servicios lleva cinco crecidas en un día, y cada una fue una
-- migración: ensanchar el check, tocar `lib/servicios.js`, desplegar. Para una
-- lista que va a seguir creciendo —área de fumadores, pet friendly, lo que
-- pidan los dueños— eso es demasiado ceremonial. Se muda a una tabla, como el
-- catálogo de tipos de comida, que ya vivía así desde el principio.
--
-- Lo que NO se muda: los dibujos. Un icono es SVG y vive en el código; la
-- tabla solo guarda cuál le toca a cada servicio, y la app tiene un dibujo
-- genérico para los que todavía no tengan el suyo. Así, agregar un servicio es
-- un INSERT: aparece en el panel y en la ficha sin desplegar nada, aunque su
-- icono llegue después.
create table public.amenities (
  slug text primary key,
  name text not null,
  hint text not null,
  icon text not null,
  position smallint not null default 100
);

comment on table public.amenities is
  'Catálogo de servicios del local. Se lee público; se edita desde la consola.';
comment on column public.amenities.icon is
  'Nombre del dibujo en app/servicios-iconos.js. Si no existe, la app pinta uno genérico.';
comment on column public.amenities.position is
  'Orden en el panel y en la ficha. Primero lo que más pesa al decidir a dónde ir.';

-- La pista de 'domicilio' se corrigió después: decía solo "Te lo llevan a tu
-- casa" y callaba que el reparto suele costar aparte, que es justo lo que
-- reclama quien lo pide creyendo que va incluido. Se edita aquí, en el
-- archivo, en vez de agregar una migración con un UPDATE, por lo mismo que la
-- semilla de al lado usa `do nothing`: un UPDATE le impondría este texto a
-- cualquier entorno donde alguien lo haya ajustado. Producción ya está
-- corregida a mano.
insert into public.amenities (slug, name, hint, icon, position) values
  ('domicilio', 'Servicio a domicilio', 'Te lo llevan a tu casa; pueden aplicar cargos adicionales', 'domicilio', 10),
  ('estacionamiento', 'Estacionamiento', 'Hay dónde dejar el carro', 'estacionamiento', 20),
  ('wifi', 'Wifi', 'Internet para los comensales', 'wifi', 30),
  ('terraza', 'Terraza', 'Mesas al aire libre', 'terraza', 40),
  ('ninos', 'Área de niños', 'Hay juegos o espacio para que jueguen', 'ninos', 50);

-- Igual que `cuisines`: lo lee cualquiera, no lo escribe nadie desde la app.
alter table public.amenities enable row level security;

create policy amenities_select_all on public.amenities
  for select to anon, authenticated using (true);

-- El check ya no puede validar la lista: una restricción no puede consultar
-- otra tabla. Lo hace un trigger, que además nombra al servicio desconocido en
-- el error en vez de dejar un 23514 seco.
alter table public.restaurants
  drop constraint restaurants_amenities_validos;

create function public.validar_amenities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desconocido text;
begin
  select s into desconocido
  from unnest(new.amenities) as s
  where not exists (select 1 from public.amenities a where a.slug = s)
  limit 1;

  if desconocido is not null then
    raise exception 'Servicio desconocido: %', desconocido
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_amenities() from public, anon, authenticated;

create trigger restaurants_validar_amenities
  before insert or update of amenities on public.restaurants
  for each row execute function public.validar_amenities();

-- Las dos restricciones del estacionamiento siguen mirando la clave suelta
-- 'estacionamiento'. Es a propósito: son reglas sobre esa fila del catálogo en
-- particular, la única que tiene preguntas propias, y un check no puede
-- consultar la tabla de todas formas.
