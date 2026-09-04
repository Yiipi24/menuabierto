-- Tres cosas que el dueño ya podía contar en prosa, pero que la ficha no sabía
-- mostrar de un vistazo: los destacados con icono, las redes sociales aparte
-- del sitio web, y qué días cierra de verdad.

-- Destacados: hasta tres frases con icono. Van en jsonb y no en una tabla
-- aparte porque son tres filas fijas que siempre se leen y se escriben junto
-- con la ficha; una tabla obligaría a un join y a otra política de RLS para
-- guardar lo mismo.
alter table public.restaurants
  add column highlights jsonb not null default '[]'::jsonb;

alter table public.restaurants
  add constraint restaurants_highlights_forma check (
    jsonb_typeof(highlights) = 'array'
    and jsonb_array_length(highlights) <= 3
  );

comment on column public.restaurants.highlights is
  'Hasta 3 destacados: [{"icon": "fuego", "text": "Ahumados al estilo BBQ"}].';

-- Redes: el sitio web sigue en `website` (es el enlace principal y ya lo usan
-- la ficha y el buscador); aquí van las demás, cada una con su red.
alter table public.restaurants
  add column social_links jsonb not null default '[]'::jsonb;

alter table public.restaurants
  add constraint restaurants_social_links_forma check (
    jsonb_typeof(social_links) = 'array'
    and jsonb_array_length(social_links) <= 8
  );

comment on column public.restaurants.social_links is
  'Redes sociales: [{"network": "instagram", "url": "https://…"}].';

-- Un día sin horas ya se entendía como cerrado, pero no se distinguía del día
-- que el dueño todavía no ha llenado. Esta lista guarda el cierre dicho a
-- propósito, para poder mostrarlo como "Cerrado" en vez de callarlo.
alter table public.restaurants
  add column closed_days smallint[] not null default '{}'::smallint[];

alter table public.restaurants
  add constraint restaurants_closed_days_validos check (
    closed_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );

comment on column public.restaurants.closed_days is
  'Días marcados como cerrados por el dueño. 0 = domingo, 6 = sábado.';

-- Las fotos ahora se piden por su papel: la fachada es la que se ve en el
-- directorio y los platillos son los que llenan la galería. Las que ya
-- existían quedan como 'otra' para no inventarles un papel que nadie eligió.
alter table public.restaurant_media
  add column category text not null default 'otra';

alter table public.restaurant_media
  add constraint restaurant_media_category_valida
    check (category in ('fachada', 'platillo', 'otra'));

comment on column public.restaurant_media.category is
  'fachada = frente del local (una sola), platillo = comida, otra = fotos previas a la clasificación.';

create index restaurant_media_category_idx
  on public.restaurant_media (restaurant_id, category);
