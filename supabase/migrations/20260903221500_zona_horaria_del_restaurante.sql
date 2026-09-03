-- "Abierto ahora" se calculaba con la hora del servidor, que en Supabase es
-- UTC: un restaurante de Monterrey aparecia cerrado a las ocho de la noche y
-- abierto de madrugada. El horario de un local solo significa algo en la hora
-- de su ciudad, asi que la zona pasa a ser un dato del restaurante.
alter table public.restaurants
  add column if not exists timezone text not null default 'America/Mexico_City';

comment on column public.restaurants.timezone is
  'Zona horaria IANA del local. Decide "abierto ahora" y el dia que la ficha marca como hoy.';

-- Mexico tiene cuatro husos. Se rellena por estado, que es lo unico que hay
-- cargado hoy; el resto se queda con el centro, que cubre a la mayoria.
update public.restaurants
set timezone = case
  when state ilike '%baja california sur%' then 'America/Mazatlan'
  when state ilike '%baja california%' then 'America/Tijuana'
  when state ilike '%sonora%' then 'America/Hermosillo'
  when state ilike '%sinaloa%' then 'America/Mazatlan'
  when state ilike '%nayarit%' then 'America/Mazatlan'
  when state ilike '%chihuahua%' then 'America/Chihuahua'
  when state ilike '%quintana roo%' then 'America/Cancun'
  else 'America/Mexico_City'
end
where state is not null;

create or replace function public.restaurant_abierto(rid uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $fn$
  -- La hora local del local: la misma que lee quien esta parado en la puerta.
  with ahora as (
    select
      timezone(coalesce(nullif(r.timezone, ''), 'America/Mexico_City'), now()) as t
    from public.restaurants r
    where r.id = rid
  )
  select exists (
    select 1
    from public.restaurant_hours h, ahora a
    where h.restaurant_id = rid
      and case
            -- Tramo normal dentro del mismo dia.
            when h.closes > h.opens
              then h.weekday = extract(dow from a.t)::smallint
                and a.t::time between h.opens and h.closes
            -- Tramo que cruza la medianoche: despues de medianoche el tramo
            -- vigente es el que abrio ayer, no el de hoy.
            else (h.weekday = extract(dow from a.t)::smallint and a.t::time >= h.opens)
              or (h.weekday = extract(dow from a.t - interval '1 day')::smallint
                  and a.t::time <= h.closes)
          end
  );
$fn$;

comment on function public.restaurant_abierto is
  'Si el restaurante tiene un tramo de horario vigente ahora mismo en la hora de su ciudad. Sin horarios cargados devuelve false.';
