-- La lista de cartas de la ficha enseña una línea bajo cada nombre. Hasta
-- ahora se armaba sola con las secciones de la carta —"Brisket, Pulled Pork y
-- Acompañamientos"—, que es un buen valor de fábrica pero no siempre es lo que
-- el dueño diría. `description` deja escribirla.
--
-- Se queda nula mientras nadie la escriba, y nula significa "úsame la
-- automática": así ninguna ficha se queda sin línea por una casilla vacía, que
-- es justo lo que pasaría si la línea dependiera solo de este campo.
alter table public.menus
  add column if not exists description text
  check (description is null or length(btrim(description)) between 1 and 140);

comment on column public.menus.description is
  'Línea que describe la carta en la ficha. Nula: se arma con sus secciones o sus primeros platillos.';
