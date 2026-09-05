-- "¿Aceptan tarjeta?" es, junto con el horario y la dirección, de lo que más
-- se pregunta por teléfono. La ficha ya tenía el renglón "Métodos de pago",
-- pero decía "Confirma con el restaurante" porque no había dónde guardarlo.

-- Un arreglo de texto y no una tabla aparte: son cinco valores de un catálogo
-- cerrado que siempre se leen y se escriben junto con la ficha, igual que
-- `closed_days`. Una tabla obligaría a un join y a otra política de RLS para
-- guardar lo mismo.
alter table public.restaurants
  add column payment_methods text[] not null default '{}'::text[];

-- El catálogo se valida aquí y no solo en la app: la ficha muestra el nombre
-- que corresponde a cada clave, y una clave inventada saldría en blanco.
alter table public.restaurants
  add constraint restaurants_payment_methods_validos check (
    payment_methods <@ array[
      'efectivo',
      'tarjeta-credito',
      'tarjeta-debito',
      'transferencia',
      'sin-contacto'
    ]::text[]
  );

comment on column public.restaurants.payment_methods is
  'Formas de pago aceptadas. Catálogo cerrado; vacío = el dueño todavía no lo dice.';
