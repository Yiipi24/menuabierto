-- El valet del local y el viene viene de la calle se separaron hace un rato en
-- dos opciones. Para quien pregunta son la misma respuesta —no hay tarifa,
-- pero se da propina— y quién la recibe ya se sabe por `parking_kind`. Dos
-- opciones para lo mismo solo obligan al dueño a elegir entre sinónimos.

-- Primero los datos, para que ninguna ficha se quede sin su respuesta.
update public.restaurants
set parking_cost = 'propina'
where parking_cost = 'viene-viene';

alter table public.restaurants
  drop constraint restaurants_parking_cost_valido;

alter table public.restaurants
  add constraint restaurants_parking_cost_valido check (
    parking_cost is null or parking_cost in ('gratis', 'propina', 'costo')
  );
