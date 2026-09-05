-- Quien sale a comer con niños chiquitos pregunta esto antes que el menú: si
-- hay dónde se entretengan, la comida dura una hora; si no, veinte minutos.
--
-- Otra vez, solo se ensancha la lista de claves válidas. Es la quinta vez que
-- este catálogo crece sin tocar el esquema, que era justo la apuesta.
alter table public.restaurants
  drop constraint restaurants_amenities_validos;

alter table public.restaurants
  add constraint restaurants_amenities_validos check (
    amenities <@ array[
      'domicilio',
      'estacionamiento',
      'wifi',
      'terraza',
      'ninos'
    ]::text[]
  );
