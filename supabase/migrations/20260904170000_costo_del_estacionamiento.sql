-- "¿Tienen estacionamiento?" trae pegada una segunda pregunta: ¿y cuánto me
-- va a costar? La respuesta cambia la decisión de a dónde ir, así que la ficha
-- tiene que poder darla.

-- Una columna aparte y no tres servicios ('estacionamiento-gratis', …): en la
-- lista serían tres cosas distintas y nada impediría marcar dos que se
-- contradicen. Aquí es lo que es, un atributo del servicio: una sola respuesta,
-- opcional, y solo si hay estacionamiento.
alter table public.restaurants
  add column parking_cost text;

alter table public.restaurants
  add constraint restaurants_parking_cost_valido check (
    parking_cost is null or parking_cost in ('gratis', 'propina', 'costo')
  );

-- El costo sin el servicio es una contradicción esperando a salir en la ficha:
-- el dueño desmarca el estacionamiento y se queda el "Gratis" del mes pasado.
-- La app ya lo limpia al guardar; la base lo vuelve imposible.
alter table public.restaurants
  add constraint restaurants_parking_cost_exige_estacionamiento check (
    parking_cost is null or 'estacionamiento' = any (amenities)
  );

comment on column public.restaurants.parking_cost is
  'Cómo se paga el estacionamiento: gratis, propina (voluntaria) o costo. Nulo = no lo dice, o no hay estacionamiento.';
