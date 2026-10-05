-- El plan Pedidos: Premium mas el asistente de WhatsApp que contesta y toma
-- pedidos.
--
-- Va en su propia migracion porque un valor nuevo de un enum no se puede usar
-- en la misma transaccion que lo agrega; las funciones que lo nombran estan en
-- `pedidos_hereda_premium`, la siguiente.
alter type public.plan_tier add value if not exists 'pedidos' after 'premium';
