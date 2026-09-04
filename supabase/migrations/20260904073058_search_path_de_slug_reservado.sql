-- El advisor de seguridad marco `slug_reservado` con search_path mutable. La
-- funcion no lee tablas ni llama a nada, asi que hoy no hay nada que secuestrar,
-- pero se fija igual: es la unica de las tres que nacio sin el, y una funcion
-- sin search_path es una excepcion que hay que volver a razonar cada vez que
-- alguien la lee.
create or replace function public.slug_reservado(segmento text)
returns boolean
language sql
immutable
set search_path = public
as $fn$
  select segmento in (
    'api', 'auth', 'entrar', 'explorar', 'favicon', 'icon', 'menu', 'panel',
    'public', 'r', 'reclamar', 'recuperar', 'registro', 'robots', 'sitemap',
    'waitlist', '_next'
  );
$fn$;
