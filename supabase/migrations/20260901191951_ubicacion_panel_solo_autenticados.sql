-- Fijar y leer la ubicacion es cosa del panel. La RLS ya impide que un anonimo
-- cambie una ficha, asi que esto no tapa ningun hueco, pero deja las dos
-- funciones fuera de su alcance en vez de confiar solo en que el update no
-- toque nada. Leer el punto tampoco es publico: la busqueda devuelve
-- distancia, no coordenadas.
revoke execute on function public.set_restaurant_location(uuid, double precision, double precision) from public, anon;
grant execute on function public.set_restaurant_location(uuid, double precision, double precision) to authenticated;

revoke execute on function public.restaurant_coords(uuid) from public, anon;
grant execute on function public.restaurant_coords(uuid) to authenticated;
