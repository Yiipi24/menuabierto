-- /comida es ahora una rama del sitio: /comida/tacos y /comida/tacos/coyoacan
-- son las páginas por tipo de comida y por zona, que es como la gente busca
-- dónde comer. Como las fichas cuelgan de la raíz, un restaurante llamado
-- "Comida" se quedaría con esa dirección y taparía la rama entera.
--
-- De paso se pone al día el resto de la lista: `avisos` y `novedades` llevan
-- siendo rutas fijas desde que existen las publicaciones, pero solo se
-- prohibieron en lib/slug.js y no aquí. Que la lista viva en dos sitios es lo
-- que permite que se separen; mientras siga así, esta es la copia que manda,
-- porque es la que la base puede hacer cumplir.
--
-- Una ficha que ya se llamara así se mueve antes de apretar el CHECK, igual
-- que hizo /q: la restricción no puede fallar por un nombre que se pidió
-- cuando era legítimo.
update public.restaurants
  set slug = split_part(slug, '/', 1) || 'restaurante'
    || case when split_part(slug, '/', 2) = '' then '' else '/' || split_part(slug, '/', 2) end
  where split_part(slug, '/', 1) in ('avisos', 'comida', 'novedades');

create or replace function public.slug_reservado(segmento text)
returns boolean
language sql
immutable
set search_path = public
as $fn$
  select segmento in (
    'api', 'auth', 'avisos', 'comida', 'entrar', 'explorar', 'favicon', 'icon',
    'menu', 'novedades', 'panel', 'public', 'q', 'r', 'reclamar', 'recuperar',
    'registro', 'robots', 'sitemap', 'waitlist', '_next'
  );
$fn$;

alter table public.restaurants
  drop constraint if exists restaurants_slug_formato;

alter table public.restaurants
  add constraint restaurants_slug_formato check (
    slug ~ '^[a-z0-9]{1,60}(/[a-z0-9]{1,60})?$'
    and split_part(slug, '/', 1) !~ '^(api|auth|avisos|comida|entrar|explorar|favicon|icon|menu|novedades|panel|public|q|r|reclamar|recuperar|registro|robots|sitemap|waitlist|_next)$'
    and split_part(slug, '/', 2) <> 'menu'
  );
