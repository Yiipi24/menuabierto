-- Los permisos que le faltaban a `programar_publicaciones`, corregidos en su
-- propia migración porque aquella ya estaba aplicada.
--
-- Dos cosas. Una: `social_post_defaults` se vuelve a escribir sin
-- `security definer`. Es un trigger BEFORE que solo toca la fila que va de
-- paso —le pone la fecha de salida, la de caducidad y congela los conteos— y
-- para eso no necesita los privilegios de quien la creó.
--
-- Dos: quién puede llamar a las dos funciones nuevas. `avisar_de_historia`
-- reparte avisos y no la llama nadie desde la API —la llama el trigger—, así
-- que se le quita el permiso a todos. `repartir_avisos_programados` sí se
-- dispara desde la aplicación, pero solo con sesión: la carga de una ficha
-- anónima no tiene por qué poder mover la bandeja de nadie.
create or replace function public.social_post_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.publish_at is null or new.publish_at < now() then
      new.publish_at := now();
    end if;

    if new.kind = 'historia' then
      new.expires_at := new.publish_at + interval '24 hours';
    else
      new.expires_at := null;
    end if;

    return new;
  end if;

  new.kind := old.kind;
  new.created_at := old.created_at;
  new.updated_at := now();

  if old.publish_at > now() then
    if new.publish_at is null or new.publish_at < now() then
      new.publish_at := now();
    end if;
  else
    new.publish_at := old.publish_at;
  end if;

  if old.kind = 'historia' then
    new.expires_at := new.publish_at + interval '24 hours';
  else
    new.expires_at := null;
  end if;

  if coalesce(current_setting('menuabierto.contando', true), 'off') <> 'on' then
    new.likes_count := old.likes_count;
    new.comments_count := old.comments_count;
    new.views_count := old.views_count;
  end if;

  return new;
end;
$$;

revoke execute on function public.avisar_de_historia(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.repartir_avisos_programados() from public, anon;
grant execute on function public.repartir_avisos_programados() to authenticated;
