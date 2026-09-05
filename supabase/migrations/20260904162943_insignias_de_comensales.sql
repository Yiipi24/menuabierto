-- Las reseñas son la mitad de la razón por la que alguien abre una ficha, pero
-- escribirlas no daba nada a cambio. Este es el marcador que faltaba: cuántas
-- lleva cada comensal, para que la app pueda ponerle metas e insignias.

-- El conteo se guarda en el perfil y no se cuenta en cada consulta: la ficha
-- pinta la insignia de quien firma cada reseña, así que en una ficha con
-- veinte reseñas serían veinte conteos sobre la tabla entera.
--
-- No hay tabla de insignias ni de metas: las insignias se derivan del conteo y
-- su catálogo (nombre, dibujo, meta) vive en `lib/insignias.js`, que es quien
-- las pinta. Una tabla aquí solo duplicaría ese catálogo y lo dejaría
-- desincronizado el día que se renombre una. Lo que sí se pierde con esta
-- decisión es la fecha en que se ganó cada una; el día que haga falta, se
-- agrega una tabla de historial y este conteo se queda como está.
alter table public.profiles
  add column reviews_count integer not null default 0;

comment on column public.profiles.reviews_count is
  'Reseñas escritas por esta persona. Lo mantiene un trigger sobre reviews.';

-- Se recalcula en vez de sumar y restar: un +1 mal puesto se acumula para
-- siempre, y contar las reseñas de una sola persona es un índice ya existente
-- (reviews_author_idx). Editar una reseña no cambia el conteo, por eso el
-- trigger no escucha updates.
create function public.refresh_profile_reviews_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.author_id, old.author_id);
begin
  update public.profiles p
  set reviews_count = (
    select count(*) from public.reviews where author_id = target
  )
  where p.id = target;
  return null;
end;
$$;

create trigger reviews_refresh_profile_count
  after insert or delete on public.reviews
  for each row execute function public.refresh_profile_reviews_count();

-- Las reseñas que ya existían también cuentan: quien lleva cinco escritas
-- desde antes no tiene por qué empezar de cero.
update public.profiles p
set reviews_count = sub.total
from (
  select author_id, count(*) as total
  from public.reviews
  group by author_id
) sub
where p.id = sub.author_id;

-- La ficha pinta la insignia junto al nombre de quien firma cada reseña, y
-- para eso necesita su conteo. Va aquí, en la misma función que ya devuelve el
-- nombre, porque `profiles` sigue siendo privado: abrirlo para leer un número
-- expondría también el teléfono.
--
-- Se borra y se vuelve a crear porque cambia la forma de lo que devuelve, y
-- eso `create or replace` no lo permite.
drop function public.resenas_restaurante(uuid);

create function public.resenas_restaurante(rid uuid)
returns table (
  id uuid,
  rating smallint,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  author_id uuid,
  author_name text,
  author_reviews integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.rating,
    v.body,
    v.created_at,
    v.updated_at,
    v.author_id,
    coalesce(nullif(btrim(p.full_name), ''), 'Comensal'),
    p.reviews_count
  from public.reviews v
  join public.profiles p on p.id = v.author_id
  where v.restaurant_id = rid
    and public.restaurant_is_public(rid)
  order by v.created_at desc;
$$;

comment on function public.resenas_restaurante(uuid) is
  'Resenas publicas de un restaurante con el nombre y el total de resenas de quien las escribio. Es security definer para leer profiles sin abrir el resto del perfil.';

revoke execute on function public.resenas_restaurante(uuid) from public;
grant execute on function public.resenas_restaurante(uuid) to anon, authenticated;
