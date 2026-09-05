-- Si un lugar solo despacha para llevar, quien busca dónde sentarse a comer
-- necesita saberlo antes de manejar hasta allá. Y al revés: el que solo quiere
-- recoger su pedido también pregunta.
--
-- Van al mismo catálogo de servicios, como dos claves más: se pueden marcar
-- las dos (lo normal), o una sola. "Solo para llevar" no es una tercera clave;
-- es lo que significa marcar `para-llevar` sin marcar `comer-aqui`, y la ficha
-- lo dice así. Una clave aparte podría contradecir a las otras dos.
alter table public.restaurants
  drop constraint restaurants_amenities_validos;

alter table public.restaurants
  add constraint restaurants_amenities_validos check (
    amenities <@ array[
      'comer-aqui',
      'para-llevar',
      'estacionamiento',
      'wifi',
      'terraza'
    ]::text[]
  );
