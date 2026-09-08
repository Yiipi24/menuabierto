-- Dos eventos nuevos para el tablero: tocar "Pedir por WhatsApp" y mandar un
-- pedido armado desde la carta.
--
-- Van en su propia migracion porque `alter type ... add value` no se puede
-- usar en la misma transaccion en que se agrega, y la siguiente migracion ya
-- necesita el enum completo.
--
-- Son dos y no uno porque responden preguntas distintas: el primero dice
-- cuanta gente quiso escribir, el segundo cuanta llego a mandar la lista de
-- platillos. La distancia entre los dos es lo unico que le dice al dueño si su
-- carta digital esta sirviendo para vender o solo para consultar.

alter type public.restaurant_event add value if not exists 'whatsapp_click';
alter type public.restaurant_event add value if not exists 'whatsapp_order';
