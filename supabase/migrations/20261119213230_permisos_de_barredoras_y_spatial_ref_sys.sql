-- Hallazgos de seguridad de la revisión del 2026-11-19 (issue #80).
--
-- 1. `limpiar_historias` se concedió a `authenticated` y se revocó de
--    `public`, pero Supabase concede las funciones nuevas a `anon` por
--    separado y revocar de `public` no se lo quita (lo explica
--    `programar_publicaciones`). El código la llama solo con sesión
--    (`recogerHistoriasViejas`), así que `anon` no la necesita.
revoke execute on function public.limpiar_historias() from anon;

-- 2. `limpiar_pases` no la llama nadie desde la app: el barrido se hace a mano
--    o con la llave de servicio. Ningún usuario con sesión tiene por qué poder
--    dispararlo.
revoke execute on function public.limpiar_pases() from public, anon, authenticated;

-- `repartir_avisos_programados` se queda como está, a propósito: la llaman el
-- feed y las acciones del panel con la sesión de quien entra, y solo reparte
-- lo que ya tocaba repartir (las filas con `notified_at` nulo y la hora
-- pasada), así que llamarla de más no hace nada.

-- 3. `spatial_ref_sys` es la tabla de PostGIS y es de `supabase_admin`: no se
--    le puede encender RLS ni quitarle permisos desde aquí, y `anon` y
--    `authenticated` tienen insert, update, delete y truncate sobre ella por
--    la API. Leerla no expone nada (son los sistemas de coordenadas públicos),
--    pero borrarla rompe las distancias. El rol `postgres` sí tiene permiso de
--    trigger, así que se cierra la escritura con uno. Lo que corre como
--    `postgres`, `service_role` o `supabase_admin` (una actualización de
--    PostGIS) sigue pudiendo escribir.
create function public.spatial_ref_sys_solo_lectura()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'spatial_ref_sys es de solo lectura' using errcode = '42501';
  end if;
  return null;
end;
$$;

comment on function public.spatial_ref_sys_solo_lectura() is
  'Rechaza la escritura en spatial_ref_sys desde anon y authenticated. La tabla es de supabase_admin y no admite RLS desde postgres.';

revoke execute on function public.spatial_ref_sys_solo_lectura() from public, anon, authenticated;

create trigger spatial_ref_sys_solo_lectura
  before insert or update or delete on public.spatial_ref_sys
  for each statement execute function public.spatial_ref_sys_solo_lectura();

create trigger spatial_ref_sys_sin_truncate
  before truncate on public.spatial_ref_sys
  for each statement execute function public.spatial_ref_sys_solo_lectura();
