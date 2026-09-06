-- Un QR por restaurante, y para siempre el mismo.
--
-- Hasta ahora cada carta tenía el suyo: el de bebidas para la barra, el de
-- comida para la mesa. En la práctica el dueño imprime un vinil y lo pega en
-- la mesa, y cuando abre la carta de temporada tiene que reimprimir todo. El
-- código pasa a ser uno solo por ficha y abre la página del restaurante, que
-- es de donde el comensal llega a cualquiera de las cartas.
--
-- El QR no apunta al slug sino a un código propio (/q/<codigo>). El slug hoy
-- no cambia, pero es texto que depende del nombre y de la colonia, y lo que
-- está impreso en un vinil no puede depender de una decisión de producto: el
-- código es un dato sin significado, no se recicla y no se puede editar.
-- Además es corto, y un QR corto tiene menos módulos: se lee de más lejos y
-- aguanta mejor una impresión sucia.

alter table public.restaurants
  add column if not exists qr_code text;

comment on column public.restaurants.qr_code is
  'Código permanente del QR impreso del restaurante. Es la ruta /q/<codigo> y no cambia nunca: un vinil pegado en la mesa no se puede reimprimir.';

-- El alfabeto se queda sin las letras y los números que se confunden al
-- dictarlos o al leerlos de un letrero: o/0, i/l/1. Siete caracteres sobre 31
-- son 27 mil millones de combinaciones, así que el código tampoco se puede
-- adivinar probando.
create or replace function public.qr_codigo_nuevo()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $fn$
declare
  alfabeto constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  intento text;
  i integer;
begin
  loop
    intento := '';
    for i in 1..7 loop
      intento := intento || substr(alfabeto, 1 + floor(random() * length(alfabeto))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.restaurants where qr_code = intento);
  end loop;
  return intento;
end;
$fn$;

comment on function public.qr_codigo_nuevo is
  'Un código de QR libre. security definer porque tiene que ver todas las fichas para saber si el código ya está tomado, y la RLS solo deja ver las publicadas.';

revoke all on function public.qr_codigo_nuevo() from public, anon, authenticated;

-- Las fichas que ya existen reciben el suyo. Fila por fila y no en un solo
-- UPDATE: dentro de la misma sentencia la función no vería los códigos que
-- ella misma acaba de repartir y podría entregar dos veces el mismo.
do $migra$
declare
  fila record;
begin
  for fila in select id from public.restaurants where qr_code is null loop
    update public.restaurants set qr_code = public.qr_codigo_nuevo() where id = fila.id;
  end loop;
end;
$migra$;

alter table public.restaurants
  alter column qr_code set not null;

alter table public.restaurants
  drop constraint if exists restaurants_qr_code_formato;

alter table public.restaurants
  add constraint restaurants_qr_code_formato check (qr_code ~ '^[a-z0-9]{4,16}$');

create unique index if not exists restaurants_qr_code_idx
  on public.restaurants (qr_code);

-- El código lo pone la base al dar de alta la ficha, y de ahí no se mueve.
-- Va en un trigger y no en un DEFAULT porque el DEFAULT no protege contra un
-- UPDATE, y lo que hay que sostener aquí es justo eso: que el papel que ya
-- está pegado en la mesa siga llevando al mismo sitio.
create or replace function public.qr_code_permanente()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.qr_code is null then
      new.qr_code := public.qr_codigo_nuevo();
    end if;
    return new;
  end if;

  if new.qr_code is distinct from old.qr_code then
    raise exception 'El código del QR no se puede cambiar: ya está impreso.'
      using errcode = '23514';
  end if;

  return new;
end;
$fn$;

drop trigger if exists restaurants_qr_code_permanente on public.restaurants;
create trigger restaurants_qr_code_permanente
  before insert or update on public.restaurants
  for each row execute function public.qr_code_permanente();

-- Quien escanea el vinil no tiene sesión, y la ficha puede estar en borrador
-- —el dueño prueba su código antes de publicar—, así que la traducción de
-- código a dirección no puede pasar por la RLS. Devuelve la dirección y el
-- estado; que un borrador se pueda ver o no lo sigue decidiendo la ficha, que
-- para un extraño da 404 igual que antes.
create or replace function public.restaurante_por_qr(codigo text)
returns table (slug text, status text)
language sql
stable
security definer
set search_path = public
as $fn$
  select r.slug, r.status
  from public.restaurants r
  where r.qr_code = lower(btrim(coalesce(codigo, '')))
  limit 1;
$fn$;

comment on function public.restaurante_por_qr is
  'La dirección y el estado de la ficha dueña de un código de QR. security definer porque quien escanea no tiene sesión y el código puede ser de una ficha todavía en borrador.';

revoke all on function public.restaurante_por_qr(text) from public;
grant execute on function public.restaurante_por_qr(text) to anon, authenticated;

-- /q es ahora una ruta fija del sitio, así que ningún restaurante puede
-- quedarse con ella. Es la misma lista que vive en lib/slug.js.
create or replace function public.slug_reservado(segmento text)
returns boolean
language sql
immutable
set search_path = public
as $fn$
  select segmento in (
    'api', 'auth', 'entrar', 'explorar', 'favicon', 'icon', 'menu', 'panel',
    'public', 'q', 'r', 'reclamar', 'recuperar', 'registro', 'robots',
    'sitemap', 'waitlist', '_next'
  );
$fn$;

-- Si alguna ficha ya se llamaba "q" se mueve antes de apretar el CHECK; es lo
-- mismo que hace `slug_disponible` cuando el nombre choca con una ruta fija.
update public.restaurants
  set slug = 'qrestaurante' || case when split_part(slug, '/', 2) = '' then '' else '/' || split_part(slug, '/', 2) end
  where split_part(slug, '/', 1) = 'q';

alter table public.restaurants
  drop constraint if exists restaurants_slug_formato;

alter table public.restaurants
  add constraint restaurants_slug_formato check (
    slug ~ '^[a-z0-9]{1,60}(/[a-z0-9]{1,60})?$'
    and split_part(slug, '/', 1) !~ '^(api|auth|entrar|explorar|favicon|icon|menu|panel|public|q|r|reclamar|recuperar|registro|robots|sitemap|waitlist|_next)$'
    and split_part(slug, '/', 2) <> 'menu'
  );
