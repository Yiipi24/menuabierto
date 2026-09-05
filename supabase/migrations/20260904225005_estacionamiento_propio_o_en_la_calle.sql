-- Dos preguntas que faltaban sobre el estacionamiento, las dos de las que
-- cambian a dónde va uno a comer.

-- 1. Dónde se deja el carro. Va aparte del costo y no como cuatro
--    combinaciones en una sola lista, porque son independientes: hay
--    estacionamiento propio de paga y hay calle gratis.
alter table public.restaurants
  add column parking_kind text;

alter table public.restaurants
  add constraint restaurants_parking_kind_valido check (
    parking_kind is null or parking_kind in ('propio', 'calle')
  );

-- Misma regla que el costo: sin estacionamiento, no hay dónde. La app lo
-- limpia al guardar; la base lo vuelve imposible.
alter table public.restaurants
  add constraint restaurants_parking_kind_exige_estacionamiento check (
    parking_kind is null or 'estacionamiento' = any (amenities)
  );

comment on column public.restaurants.parking_kind is
  'Dónde se estaciona: propio (del local) o calle. Nulo = no lo dice, o no hay estacionamiento.';

-- 2. El viene viene. No es lo mismo que la propina voluntaria de un valet: no
--    lo pone el restaurante, está en la calle, y quien pregunta si hay dónde
--    dejar el carro quiere saber justo eso antes de llegar.
alter table public.restaurants
  drop constraint restaurants_parking_cost_valido;

alter table public.restaurants
  add constraint restaurants_parking_cost_valido check (
    parking_cost is null
    or parking_cost in ('gratis', 'propina', 'viene-viene', 'costo')
  );
