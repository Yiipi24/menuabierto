-- restaurant_coords existia para llenar un formulario del panel, pero devolvia
-- el punto de cualquier ficha que la RLS dejara leer, es decir de cualquier
-- publicada. No es un secreto, pero la funcion no tiene por que servir de mas
-- de para lo que se hizo: ahora solo contesta al duenio.
create or replace function public.restaurant_coords(rid uuid)
returns table (lat double precision, lng double precision)
language sql
stable
security invoker
set search_path = public
as $fn$
  select st_y(r.location::geometry), st_x(r.location::geometry)
  from public.restaurants r
  where r.id = rid
    and r.location is not null
    and r.owner_id = (select auth.uid());
$fn$;

comment on function public.restaurant_coords is
  'Latitud y longitud de una ficha propia, para los formularios del panel. Sin coordenadas, o si quien pregunta no es el duenio, no devuelve fila.';

revoke execute on function public.restaurant_coords(uuid) from public, anon;
grant execute on function public.restaurant_coords(uuid) to authenticated;
