-- /planes es la página pública de planes y precios. Las fichas cuelgan de
-- la raíz, así que un restaurante llamado "Planes" no puede quedarse con la
-- dirección. La lista tiene que ser la misma que RESERVADAS en lib/slug.js.
create or replace function public.slug_reservado(segmento text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select segmento in (
    'api', 'auth', 'avisos', 'comida', 'entrar', 'explorar', 'favicon', 'icon',
    'instalar', 'menu', 'novedades', 'panel', 'planes', 'precios', 'privacidad',
    'public', 'q', 'r', 'reclamar', 'recuperar', 'registro', 'robots', 'sitemap',
    'terminos', 'waitlist', '_next'
  );
$$;
