-- Vales de despensa: en México media oficina come con ellos, y quien los trae
-- necesita saber antes de sentarse si el lugar los toma.
--
-- Va como migración y no como el INSERT suelto de la consola porque su dibujo
-- exige tocar el código de todas formas: si el despliegue ya va a ocurrir,
-- meter la fila aquí deja las dos mitades juntas y de paso la recoge para
-- cualquier entorno nuevo. El INSERT desde la consola sigue siendo el camino
-- del día a día, cuando lo único que se agrega es la fila.
--
-- `do nothing` por si alguien ya la agregó a mano antes de que esto corriera:
-- su texto manda sobre el de este archivo.
insert into public.payment_methods (slug, name, hint, icon, position)
values ('vales', 'Vales de despensa', 'Se aceptan vales de despensa', 'vales', 60)
on conflict (slug) do nothing;
