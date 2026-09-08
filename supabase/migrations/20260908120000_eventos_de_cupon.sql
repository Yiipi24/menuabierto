-- Un cupón se mide en tres momentos: cuando se ve en la ficha, cuando alguien
-- se lleva el código y cuando ese código se canjea en la caja. Los dos
-- primeros son eventos de la ficha, como el teléfono o el WhatsApp; el tercero
-- lo registra el dueño en la caja y vive en su propia tabla, `coupon_redemptions`.
--
-- Los valores del enum van en su propia migración a propósito: Postgres no
-- deja usar un valor recién agregado en la misma transacción que lo agregó, y
-- la migración que sigue los necesita.
alter type public.restaurant_event add value if not exists 'coupon_view';
alter type public.restaurant_event add value if not exists 'coupon_copy';
