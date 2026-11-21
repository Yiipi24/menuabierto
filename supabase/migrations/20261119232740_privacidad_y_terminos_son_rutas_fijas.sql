-- /privacidad y /terminos son páginas fijas: el aviso de privacidad y los
-- términos (#81). Las fichas cuelgan de la raíz, así que un restaurante
-- llamado "Privacidad" no puede quedarse con la dirección. Se ponen también
-- `instalar` y `precios`, que `RESERVADAS` de lib/slug.js ya tenía y aquí
-- faltaban: las dos listas tienen que ser la misma.
create or replace function public.slug_reservado(segmento text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select segmento in (
    'api', 'auth', 'avisos', 'comida', 'entrar', 'explorar', 'favicon', 'icon',
    'instalar', 'menu', 'novedades', 'panel', 'precios', 'privacidad', 'public',
    'q', 'r', 'reclamar', 'recuperar', 'registro', 'robots', 'sitemap',
    'terminos', 'waitlist', '_next'
  );
$$;
