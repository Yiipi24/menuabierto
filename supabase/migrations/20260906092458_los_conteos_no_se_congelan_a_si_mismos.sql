-- Los conteos se quedaban en cero.
--
-- `social_post_defaults` corre BEFORE UPDATE y congela los tres conteos para
-- que nadie los escriba desde el cliente: un dueño con la llave publicable
-- podría inflar los likes de su propia publicación con un PATCH. La intención
-- era correcta, pero la red atrapaba también a quien sí tiene derecho a
-- moverlos: `contar_social` hace justamente un UPDATE sobre `social_posts`, así
-- que el trigger deshacía el incremento antes de escribirlo y el like quedaba
-- registrado en su tabla con el contador en cero.
--
-- La marca la pone la propia función que cuenta, con `set_config` local a la
-- transacción: fuera de ella nadie puede encenderla, porque `contar_social` no
-- es ejecutable por el cliente (solo la llaman los triggers, que corren como
-- definer). El trigger sigue congelando todo lo demás.

create or replace function public.contar_social(columna text, pid uuid, delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('menuabierto.contando', 'on', true);
  execute format(
    'update public.social_posts set %I = greatest(%I + $1, 0) where id = $2',
    columna, columna
  ) using delta, pid;
  perform set_config('menuabierto.contando', 'off', true);
end;
$$;

create or replace function public.social_post_defaults()
returns trigger
language plpgsql
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

-- Los conteos que quedaron mal mientras el trigger los deshacía. Es una tabla
-- recién creada, así que esto es la corrección de las pruebas y de nada más;
-- se deja escrito porque reaplicar de cero tiene que dar el mismo esquema.
update public.social_posts p
   set likes_count = (select count(*) from public.social_likes l where l.post_id = p.id),
       comments_count = (select count(*) from public.social_comments c where c.post_id = p.id),
       views_count = (select count(*) from public.social_story_views v where v.post_id = p.id);
