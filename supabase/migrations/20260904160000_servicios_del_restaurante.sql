-- "¿Tienen estacionamiento?" es la otra pregunta que se hace antes de salir de
-- casa, junto con la de si aceptan tarjeta. La ficha no tenía dónde guardarla.

-- Un arreglo con catálogo cerrado y no un `has_parking` booleano: el segundo
-- servicio (terraza, wifi, área de niños) sería otra columna, otro campo en el
-- formulario y otro renglón en la ficha. Así es una línea en el catálogo.
alter table public.restaurants
  add column amenities text[] not null default '{}'::text[];

alter table public.restaurants
  add constraint restaurants_amenities_validos check (
    amenities <@ array['estacionamiento']::text[]
  );

comment on column public.restaurants.amenities is
  'Servicios del local. Catálogo cerrado; vacío = el dueño todavía no lo dice.';
