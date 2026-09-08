-- Pedir por WhatsApp.
--
-- El restaurante ya toma pedidos por ahi; lo que no tenia era una forma de
-- decirlo en su ficha ni de recibir la lista escrita. Son tres columnas: el
-- interruptor, el numero al que llega el mensaje y la letra chica (el pedido
-- minimo, la zona de entrega, el horario de cocina).
--
-- El numero va aparte de `phone` a proposito: el telefono de la ficha suele
-- ser el fijo del local y el WhatsApp el celular de quien contesta. Obligar a
-- que sean el mismo dejaria a la mitad de los locales sin poder prender esto.

alter table public.restaurants
  add column whatsapp_orders boolean not null default false,
  add column whatsapp_phone text,
  add column whatsapp_note text;

-- Solo digitos, con lada, como lo quiere wa.me. La app normaliza antes de
-- escribir (ver `lib/whatsapp.js`); esto es la red de abajo, para que ningun
-- otro cliente meta un "81-1234-5678" que despues no abre ningun chat.
alter table public.restaurants
  add constraint restaurants_whatsapp_phone_formato
    check (whatsapp_phone is null or whatsapp_phone ~ '^[0-9]{11,15}$');

alter table public.restaurants
  add constraint restaurants_whatsapp_note_largo
    check (whatsapp_note is null or length(whatsapp_note) <= 120);

-- Un interruptor prendido sin numero es un boton que no lleva a ningun lado.
-- La ficha ya se defiende de eso, pero es la base la que no deberia poder
-- guardar el estado imposible.
alter table public.restaurants
  add constraint restaurants_whatsapp_con_numero
    check (not whatsapp_orders or whatsapp_phone is not null);

comment on column public.restaurants.whatsapp_orders is
  'Si la ficha ofrece "Pedir por WhatsApp". Exige whatsapp_phone.';
comment on column public.restaurants.whatsapp_phone is
  'Numero de WhatsApp en formato wa.me: solo digitos y con lada. Puede no ser el mismo que phone.';
comment on column public.restaurants.whatsapp_note is
  'La letra chica del pedido: minimo, zona de entrega, horario. Se enseña junto al boton.';
