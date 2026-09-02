-- Las llaves de secciones y platillos hacia menus son compuestas
-- (menu_id, restaurant_id), y un indice que solo empieza por menu_id no las
-- cubre: borrar un menu recorre la tabla hija entera para encontrar sus hijos.
--
-- En vez de un segundo indice al lado, se amplia el que ya existe. Dentro de
-- un menu el restaurante es siempre el mismo, asi que anteponer restaurant_id
-- a position no le quita nada al orden y de paso cubre la llave completa.
drop index public.menu_sections_menu_idx;
drop index public.menu_items_menu_idx;

create index menu_sections_menu_idx
  on public.menu_sections (menu_id, restaurant_id, position);
create index menu_items_menu_idx
  on public.menu_items (menu_id, restaurant_id, position);
