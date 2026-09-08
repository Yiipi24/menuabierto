-- Los permisos de lo que estrenó la migración anterior, apretados.
--
-- `revoke ... from public` no basta en Supabase: el proyecto tiene privilegios
-- por defecto que le dan EXECUTE a anon y a authenticated sobre cada función
-- nueva de `public`, y eso es un grant propio que sobrevive al revoke de
-- PUBLIC. Hay que quitárselo por nombre.

-- Las de trigger no las llama nadie: solo las dispara la tabla. Anon podía
-- invocarlas por PostgREST —no rompen nada sin un contexto de trigger, pero
-- tampoco tienen por qué estar ahí—. Mismo trato que `contar_seguidores`.
revoke all on function public.contar_favoritos() from public, anon, authenticated;
revoke all on function public.contar_canjes() from public, anon, authenticated;
revoke all on function public.menu_principal_unico() from public, anon, authenticated;

-- Duplicar una carta y listar las sucursales son cosas del dueño. Las dos
-- comprueban `owns_restaurant`, así que anon no sacaba nada de ellas; aun así
-- una función `security definer` no debería estar al alcance de quien no ha
-- entrado.
revoke all on function public.duplicar_menu(uuid, uuid, text) from public, anon;
grant execute on function public.duplicar_menu(uuid, uuid, text) to authenticated;

revoke all on function public.mis_sucursales(uuid) from public, anon;
grant execute on function public.mis_sucursales(uuid) to authenticated;

-- `coupon_vigente` sí la ejecuta anon, y a propósito: es la condición de la
-- política que decide qué cupones se ven en una ficha pública, y una política
-- se evalúa con el rol de quien consulta. Lo que le faltaba era el
-- `search_path` fijo que llevan todas las demás.
create or replace function public.coupon_vigente(c public.coupons)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select c.is_active
     and (c.starts_at is null or c.starts_at <= now())
     and (c.ends_at is null or c.ends_at > now())
     and (c.max_redemptions is null or c.redemptions_count < c.max_redemptions);
$fn$;
