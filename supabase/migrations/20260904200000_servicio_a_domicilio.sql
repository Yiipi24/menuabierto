-- El tercer canal por el que sale la comida. No es una respuesta más de
-- `service_mode` —esas tres se excluyen entre sí y esta no se pelea con
-- ninguna: un lugar con mesas puede además mandar a domicilio— así que va al
-- catálogo de servicios, que es justo el que admite marcar varios.
alter table public.restaurants
  drop constraint restaurants_amenities_validos;

alter table public.restaurants
  add constraint restaurants_amenities_validos check (
    amenities <@ array['domicilio', 'estacionamiento', 'wifi', 'terraza']::text[]
  );
