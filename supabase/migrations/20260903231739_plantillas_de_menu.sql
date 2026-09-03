-- Las plantillas eran cuatro variantes de la misma lista: cambiaba la
-- tipografia y poco mas. Aqui la plantilla pasa a ser un diseno completo
-- —encabezado con el nombre del menu, el del restaurante y lo que lo
-- distingue— y ademas se puede ajustar sin tocar el codigo: color, letra y
-- densidad los elige el dueno.

-- 1. Una plantilla nueva: el pizarron de la pared, con marco de madera.
alter table public.menus drop constraint menus_template_check;

alter table public.menus add constraint menus_template_check
  check (template in ('clasica', 'pizarra', 'elegante', 'compacta', 'pizarron'));

-- 2. Los ajustes de la plantilla. Van en jsonb y no en cinco columnas porque
--    cada plantilla nueva trae los suyos, y una migracion por cada perilla
--    seria una migracion por semana. La aplicacion valida lo que lee: lo que
--    no reconozca cae al valor por omision de la plantilla.
alter table public.menus add column style jsonb not null default '{}'::jsonb;

comment on column public.menus.style is
  'Ajustes de la plantilla: {"paleta","tipografia","densidad","destacados","iconos","marco"}. Vacio = los de la plantilla.';

-- 3. El icono del platillo. Es un dibujo de trazo del catalogo, no una foto:
--    pesa cero, se ve igual en cualquier plantilla y no obliga al dueno a
--    conseguir una foto decente de cada platillo. Nulo = se adivina del
--    nombre ("hamburguesa" -> hamburguesa); 'ninguno' = el dueno no quiere.
alter table public.menu_items add column icon text;

comment on column public.menu_items.icon is
  'Icono del catalogo. Nulo = se deduce del nombre del platillo. "ninguno" = sin icono.';
