-- Lo mismo que ya pasó con el trigger del QR y con el de insignias, ahora con
-- los cinco de la parte social: nacieron con el EXECUTE que Postgres reparte a
-- `public` y con el que Supabase da por defecto a `anon` y `authenticated`, así
-- que PostgREST los publica como /rest/v1/rpc/<nombre> y el advisor los marca
-- como funciones `security definer` que puede llamar cualquiera.
--
-- Con `contar_social` no es solo higiene. No es una función de trigger: recibe
-- el nombre de la columna, el id y cuánto sumar, y hace el UPDATE saltándose la
-- red que congela los conteos. Publicada en la API, cualquiera con la llave
-- publicable podía ponerle mil Me gusta a la publicación que quisiera sin
-- dejar una sola fila en `social_likes`. El `revoke ... from public` de la
-- migración anterior no bastaba: los permisos que sobraban eran los de los dos
-- roles, no el de PUBLIC.
--
-- Los triggers siguen disparando: el permiso de EXECUTE se comprueba al crear
-- el trigger, no cada vez que la fila cambia.
revoke all on function public.contar_social(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.social_post_defaults() from public, anon, authenticated;
revoke all on function public.contar_seguidores() from public, anon, authenticated;
revoke all on function public.social_likes_conteo() from public, anon, authenticated;
revoke all on function public.social_comments_conteo() from public, anon, authenticated;
revoke all on function public.social_views_conteo() from public, anon, authenticated;
revoke all on function public.avisar_historia() from public, anon, authenticated;

-- `social_post_defaults` se quedó sin `search_path` fijo. Es la única de la
-- migración a la que se le olvidó, y en una función que corre con los permisos
-- de quien la definió eso es lo que abre la puerta a que un esquema puesto
-- delante en el `search_path` de la sesión suplante a `public`.
create or replace function public.social_post_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'historia' then
      new.expires_at := now() + interval '24 hours';
    else
      new.expires_at := null;
    end if;
    return new;
  end if;

  -- Ni el tipo ni la caducidad ni la fecha de publicación cambian al editar:
  -- una historia caducada no puede volverse una publicación eterna.
  new.kind := old.kind;
  new.expires_at := old.expires_at;
  new.created_at := old.created_at;
  new.updated_at := now();

  -- Los conteos solo los mueve `contar_social`, que enciende la marca justo
  -- antes de su UPDATE. Cualquier otro update los deja como estaban.
  if coalesce(current_setting('menuabierto.contando', true), 'off') <> 'on' then
    new.likes_count := old.likes_count;
    new.comments_count := old.comments_count;
    new.views_count := old.views_count;
  end if;

  return new;
end;
$$;

revoke all on function public.social_post_defaults() from public, anon, authenticated;
