-- Las fotos de platillos ahora pueden decir qué son.
--
-- Hasta hoy una foto era una ruta en el bucket y su papel (fachada o
-- platillo). La ficha nueva las enseña grandes, con el nombre del platillo en
-- una franja, y abre cada una en un visor con su descripción y su precio.
-- Para eso el dueño necesita ponerles nombre, etiqueta, descripción y —si
-- quiere— colgarlas de un platillo de su carta.
--
-- Todo es opcional y con default: una foto sin nombre se sigue viendo como se
-- veía, sin franja. `alt` y `position` ya existían y siguen siendo el texto
-- alternativo y el orden.
alter table public.restaurant_media
  add column dish_name text,
  add column dish_label text,
  add column description text,
  add column menu_item_id uuid references public.menu_items (id) on delete set null,
  add column is_featured boolean not null default false,
  add column is_visible boolean not null default true;

-- Un nombre que no cabe en una franja no es un nombre.
alter table public.restaurant_media
  add constraint restaurant_media_dish_name_corto check (dish_name is null or char_length(dish_name) <= 80),
  add constraint restaurant_media_dish_label_corta check (dish_label is null or char_length(dish_label) <= 40),
  add constraint restaurant_media_description_corta check (description is null or char_length(description) <= 400),
  add constraint restaurant_media_alt_corto check (alt is null or char_length(alt) <= 200);

comment on column public.restaurant_media.dish_name is
  'Nombre del platillo que sale en la franja de la foto. Sin él la foto se enseña sin franja.';
comment on column public.restaurant_media.dish_label is
  'Etiqueta corta opcional: Especialidad, Para compartir, Favorito…';
comment on column public.restaurant_media.menu_item_id is
  'El platillo de la carta al que pertenece la foto, si el dueño la colgó de uno. Da el precio y el enlace "Ver en el menú".';
comment on column public.restaurant_media.is_featured is
  'Si sale en "Favoritos de la casa", la galería grande bajo el encabezado de la ficha.';
comment on column public.restaurant_media.is_visible is
  'Apagada, la foto se guarda pero no se enseña en la ficha.';

-- Borrar un platillo o una carta ya no deja fotos huérfanas gracias al
-- `on delete set null`, pero el índice hace barato ese barrido.
create index restaurant_media_menu_item_idx
  on public.restaurant_media (menu_item_id)
  where menu_item_id is not null;

create index restaurant_media_destacadas_idx
  on public.restaurant_media (restaurant_id, is_featured, position)
  where is_visible;
