-- Tres llaves foráneas se quedaron sin índice que las cubra. Importan por el
-- borrado en cascada más que por las consultas: al borrar una historia,
-- Postgres tiene que encontrar los avisos y las vistas que cuelgan de ella, y
-- sin índice eso es un recorrido de la tabla entera por cada pieza borrada.
-- La barredora de historias caducadas borra en lote, así que es justo el caso
-- que más lo nota.

-- Los avisos de una historia: los busca la cascada al borrarla.
create index notifications_post_idx on public.notifications (post_id);

-- Los avisos de un restaurante: la cascada al borrar la ficha.
create index notifications_restaurante_idx on public.notifications (restaurant_id);

-- Las vistas de una persona: la cascada al borrar su cuenta. La llave primaria
-- ya cubre el camino contrario —las vistas de una historia—, que es el que
-- recorre el conteo.
create index social_story_views_profile_idx on public.social_story_views (profile_id);
