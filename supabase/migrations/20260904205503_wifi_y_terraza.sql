-- Dos servicios más de los que se preguntan antes de elegir a dónde ir: el
-- wifi (quien va a trabajar una tarde lo pregunta primero) y la terraza (quien
-- va con perro, o a fumar, o simplemente prefiere estar afuera).
--
-- Es exactamente el cambio que el catálogo prometía: solo se ensancha la lista
-- de claves válidas. Ni columna nueva ni tabla nueva.
alter table public.restaurants
  drop constraint restaurants_amenities_validos;

alter table public.restaurants
  add constraint restaurants_amenities_validos check (
    amenities <@ array['estacionamiento', 'wifi', 'terraza']::text[]
  );
