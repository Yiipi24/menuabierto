-- Ayer "comer en el lugar" y "para llevar" entraron como dos casillas más de
-- la lista de servicios. Está mal planteado: las respuestas se excluyen entre
-- sí y como casillas nada impedía marcar las dos al revés de lo que se quería
-- decir, ni distinguir "no lo dice" de "no se puede". Es una pregunta con una
-- sola respuesta, así que ahora es una columna con una sola respuesta.
alter table public.restaurants
  add column service_mode text;

alter table public.restaurants
  add constraint restaurants_service_mode_valido check (
    service_mode is null or service_mode in ('ambos', 'solo-sitio', 'solo-llevar')
  );

comment on column public.restaurants.service_mode is
  'Cómo se sirve: ambos, solo-sitio o solo-llevar. Nulo = el dueño no lo dice.';

-- Lo poco que se haya alcanzado a guardar con el modelo viejo se traduce en
-- vez de perderse: quien ya marcó sus casillas no tiene por qué volver a
-- entrar a decir lo mismo.
update public.restaurants
set service_mode = case
  when 'comer-aqui' = any (amenities) and 'para-llevar' = any (amenities) then 'ambos'
  when 'comer-aqui' = any (amenities) then 'solo-sitio'
  else 'solo-llevar'
end
where 'comer-aqui' = any (amenities) or 'para-llevar' = any (amenities);

-- Y las claves viejas salen de la lista, primero de los datos y luego del
-- catálogo permitido: dejarlas sería tener la misma respuesta en dos lugares
-- que pueden contradecirse.
update public.restaurants
set amenities = array_remove(array_remove(amenities, 'comer-aqui'), 'para-llevar')
where 'comer-aqui' = any (amenities) or 'para-llevar' = any (amenities);

alter table public.restaurants
  drop constraint restaurants_amenities_validos;

alter table public.restaurants
  add constraint restaurants_amenities_validos check (
    amenities <@ array['estacionamiento', 'wifi', 'terraza']::text[]
  );
