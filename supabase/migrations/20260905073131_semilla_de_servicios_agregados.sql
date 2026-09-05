-- Mudar el catálogo a una tabla tuvo un costo que se ve solo al levantar un
-- entorno nuevo: los servicios que se agregan con un INSERT viven en los datos
-- y no en las migraciones, así que una base creada desde cero se quedaba con
-- los cinco originales y sin los cinco que llegaron después.
--
-- Esta es la semilla que los alcanza. No sustituye al INSERT del día a día
-- —agregar un servicio sigue siendo una línea en la consola, sin desplegar—
-- sino que recoge lo agregado para que un entorno nuevo nazca igual al de
-- producción.
--
-- `do nothing` y no `do update`: en producción estas filas ya existen y su
-- nombre o su pista pueden haberse ajustado desde la consola. Un `do update`
-- las regresaría al texto de este archivo cada vez que alguien corriera las
-- migraciones, que es justo lo contrario de tener el catálogo en una tabla.
-- La pista de 'mascotas' se corrigió después de escribir esta semilla: decía
-- "tu perro" y dejaba fuera al resto. Se edita aquí, en el archivo, en vez de
-- agregar una migración con un UPDATE, porque un UPDATE le impondría este
-- texto a cualquier entorno donde alguien lo haya ajustado a su gusto —lo
-- mismo que evita el `do nothing` de abajo—. Los entornos que ya corrieron
-- esta semilla conservan el texto viejo hasta que lo cambien ellos; el de
-- producción ya está corregido a mano.
insert into public.amenities (slug, name, hint, icon, position) values
  ('reservaciones', 'Acepta reservaciones', 'Puedes apartar mesa antes de ir', 'reservaciones', 5),
  ('accesibilidad', 'Acceso para silla de ruedas', 'Se puede entrar y moverse en silla', 'accesibilidad', 15),
  ('aire-acondicionado', 'Aire acondicionado', 'El local es climatizado', 'aire-acondicionado', 35),
  ('fumadores', 'Área de fumadores', 'Hay zona para fumar', 'fumadores', 60),
  ('mascotas', 'Pet friendly', 'Puedes venir con tu mascota', 'mascotas', 70)
on conflict (slug) do nothing;
