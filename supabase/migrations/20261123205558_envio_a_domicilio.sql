-- El envío a domicilio como reglas que el asistente aplica (#97): el pedido
-- mínimo, hasta tres zonas por radio con su costo y su tiempo, el envío gratis
-- desde un monto y el tiempo para llevar. Antes todo eso era texto libre en
-- `whatsapp_note`, que el cliente leía y nadie aplicaba.

alter table public.restaurants
  add column delivery_min_cents integer,
  add column delivery_free_from_cents integer,
  add column delivery_zones jsonb not null default '[]'::jsonb,
  add column pickup_minutes smallint;

alter table public.restaurants
  add constraint restaurants_delivery_min_valido
    check (delivery_min_cents is null or delivery_min_cents between 1 and 10000000),
  add constraint restaurants_delivery_free_valido
    check (delivery_free_from_cents is null or delivery_free_from_cents between 1 and 10000000),
  -- [{ max_km, fee_cents, minutes }]: lo valida `lib/envio.js` al guardar;
  -- aquí solo la forma y el tope, para que un dato raro no llegue al asistente.
  add constraint restaurants_delivery_zones_forma
    check (jsonb_typeof(delivery_zones) = 'array' and jsonb_array_length(delivery_zones) <= 3),
  add constraint restaurants_pickup_minutes_valido
    check (pickup_minutes is null or pickup_minutes between 5 and 240);

comment on column public.restaurants.delivery_zones is
  'Zonas de envío por radio desde el punto del local: [{max_km, fee_cents, minutes}], de la más cercana a la más lejana. max_km null es "más lejos" (o el envío fijo, si es la única).';

-- Lo que se le prometió al cliente con el pedido: el envío cobrado, el tiempo
-- dicho y a cuánto estaba. El total de los platillos sigue en `total_cents`
-- (las estadísticas de ventas cuentan platillos, no envíos).
alter table public.orders
  add column delivery_fee_cents integer check (delivery_fee_cents is null or delivery_fee_cents between 0 and 10000000),
  add column eta_minutes smallint check (eta_minutes is null or eta_minutes between 5 and 240),
  add column distance_m integer check (distance_m is null or distance_m between 0 and 20000000);

-- La distancia en línea recta de un punto al local, en metros. La usa el
-- webhook del asistente cuando un cliente comparte su ubicación. Devuelve
-- solo el número: las coordenadas del restaurante no salen de la base
-- (`restaurant_coords` solo le contesta al dueño). Sin punto del local, o
-- con un punto que no existe, no devuelve nada.
create function public.distancia_de_entrega(p_restaurant uuid, p_lat double precision, p_lng double precision)
returns double precision
language sql
stable
security definer
set search_path = public
as $fn$
  select st_distance(r.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  from public.restaurants r
  where r.id = p_restaurant
    and r.location is not null
    and p_lat between -90 and 90
    and p_lng between -180 and 180;
$fn$;

comment on function public.distancia_de_entrega is
  'Metros en línea recta entre un punto y el local. Solo para el webhook del asistente (service_role).';

revoke execute on function public.distancia_de_entrega(uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function public.distancia_de_entrega(uuid, double precision, double precision) to service_role;
