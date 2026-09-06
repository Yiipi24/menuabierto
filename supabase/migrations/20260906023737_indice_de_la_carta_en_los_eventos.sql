-- El advisor de rendimiento marcó `restaurant_events_menu_id_fkey` sin índice
-- que la cubra, y tenía razón: el índice que se creó con la columna empieza por
-- `restaurant_id`, así que no sirve para la llave foránea. Borrar un menú tiene
-- que recorrer los eventos enteros para poner su `menu_id` en nulo.
--
-- El compuesto se va con él: la consulta del tablero filtra por ficha y fecha
-- —eso ya lo resuelve `restaurant_events_ficha_idx`— y agrupa por carta en
-- memoria sobre las filas del periodo, que son pocas. Un índice que nadie usa
-- solo encarece cada evento que se escribe.
drop index if exists public.restaurant_events_carta_idx;

create index restaurant_events_menu_idx
  on public.restaurant_events (menu_id)
  where menu_id is not null;
