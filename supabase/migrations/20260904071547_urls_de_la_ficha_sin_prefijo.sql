-- La direccion de una ficha era /r/jc-smoke-house-j5e24: el prefijo /r/, los
-- guiones y un sufijo aleatorio que nadie puede dictar por telefono ni leer en
-- un vinil. Ahora es menuabierto.com/jcsmokehouse, y cuando dos restaurantes
-- se llaman igual el segundo agrega su colonia: /tacoselgordo/centro.
--
-- El slug guarda la direccion completa, con la barra dentro, porque lo que
-- tiene que ser unico es la direccion entera y de eso ya se encarga el indice
-- unico que la columna trae desde el principio.

-- El slug viejo se conserva: los QR impresos y los enlaces compartidos apuntan
-- a el, y la app los redirige a la direccion nueva en vez de darles un 404.
alter table public.restaurants
  add column if not exists legacy_slug text;

comment on column public.restaurants.legacy_slug is
  'Slug anterior (formato /r/nombre-con-guiones-sufijo). Solo para redirigir enlaces y QR ya impresos.';

create unique index if not exists restaurants_legacy_slug_idx
  on public.restaurants (legacy_slug)
  where legacy_slug is not null;

-- "JC Smoke House" -> "jcsmokehouse". Todo pegado: fuera espacios, guiones,
-- puntos y acentos. Se usa translate y no unaccent para que la funcion sea
-- inmutable y no dependa del diccionario ni del search_path de la extension.
create or replace function public.slug_segmento(texto text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select left(
    regexp_replace(
      lower(translate(
        coalesce(texto, ''),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', '', 'g'
    ),
    60
  );
$fn$;

comment on function public.slug_segmento is
  'Un tramo de URL a partir de texto libre: minusculas, sin acentos y sin nada que no sea letra o numero.';

-- Las rutas fijas del sitio. Un restaurante llamado "Panel" no puede quedarse
-- con /panel. La misma lista vive en lib/slug.js; las dos tienen que decir lo
-- mismo, y por eso la de aqui es tambien la que valida el CHECK de abajo.
create or replace function public.slug_reservado(segmento text)
returns boolean
language sql
immutable
as $fn$
  select segmento in (
    'api', 'auth', 'entrar', 'explorar', 'favicon', 'icon', 'menu', 'panel',
    'public', 'r', 'reclamar', 'recuperar', 'registro', 'robots', 'sitemap',
    'waitlist', '_next'
  );
$fn$;

-- Devuelve la primera direccion libre para un restaurante: el nombre pelado,
-- si no el nombre con la colonia, y solo como ultimo recurso un numero.
--
-- security definer porque tiene que ver TODAS las fichas para saber si un slug
-- esta tomado, y la RLS solo deja leer las publicadas: sin esto, un nombre
-- repetido contra un borrador ajeno reventaria en el insert.
create or replace function public.slug_disponible(p_nombre text, p_colonia text default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  raiz text;
  zona text;
  intento text;
  n integer := 2;
begin
  raiz := public.slug_segmento(p_nombre);
  if raiz = '' then
    raiz := 'restaurante';
  end if;
  if public.slug_reservado(raiz) then
    raiz := raiz || 'restaurante';
  end if;

  if not exists (select 1 from public.restaurants where slug = raiz) then
    return raiz;
  end if;

  zona := public.slug_segmento(p_colonia);
  -- Una colonia llamada "menu" chocaria con /restaurante/menu, que es la carta.
  if zona = 'menu' then
    zona := '';
  end if;

  if zona <> '' then
    intento := raiz || '/' || zona;
    if not exists (select 1 from public.restaurants where slug = intento) then
      return intento;
    end if;
  end if;

  -- Dos veces el mismo nombre en la misma colonia: se numera el tramo que
  -- corresponda en vez de inventar una colonia que no existe.
  while n < 1000 loop
    intento := case when zona <> '' then raiz || '/' || zona || n::text else raiz || n::text end;
    if not exists (select 1 from public.restaurants where slug = intento) then
      return intento;
    end if;
    n := n + 1;
  end loop;

  return raiz || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
end;
$fn$;

comment on function public.slug_disponible is
  'Primera direccion libre para una ficha: nombre, nombre/colonia y, si no queda otra, numerada. Ve todas las fichas a proposito, por eso es security definer.';

revoke execute on function public.slug_disponible(text, text) from public, anon;
grant execute on function public.slug_disponible(text, text) to authenticated;

-- Las fichas que ya existen se pasan al formato nuevo. Se recorren por fecha
-- de alta para que, ante nombres repetidos, la mas antigua se quede con el
-- nombre pelado: es la que lleva mas tiempo con esa direccion circulando.
do $migra$
declare
  fila record;
  nuevo text;
begin
  update public.restaurants set legacy_slug = slug where legacy_slug is null;

  -- El slug viejo se aparta antes de repartir los nuevos: si no, el
  -- "jcsmokehouse" que le toca a una ficha podria chocar con el slug viejo de
  -- otra que todavia no se ha migrado.
  update public.restaurants set slug = 'migrando-' || id::text;

  for fila in
    select id, name, neighborhood from public.restaurants order by created_at, id
  loop
    nuevo := public.slug_disponible(fila.name, fila.neighborhood);
    update public.restaurants set slug = nuevo where id = fila.id;
  end loop;
end;
$migra$;

-- A partir de aqui la forma de la direccion es parte del esquema y no una
-- convencion que solo respeta la app: un tramo, o dos separados por una barra,
-- de letras y numeros, sin pisar las rutas fijas del sitio.
alter table public.restaurants
  drop constraint if exists restaurants_slug_formato;

alter table public.restaurants
  add constraint restaurants_slug_formato check (
    slug ~ '^[a-z0-9]{1,60}(/[a-z0-9]{1,60})?$'
    and split_part(slug, '/', 1) !~ '^(api|auth|entrar|explorar|favicon|icon|menu|panel|public|r|reclamar|recuperar|registro|robots|sitemap|waitlist|_next)$'
    and split_part(slug, '/', 2) <> 'menu'
  );
