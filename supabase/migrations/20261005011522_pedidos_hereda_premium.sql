-- Pedidos incluye todo lo de Premium, mas menus.
--
-- Solo dos funciones preguntaban por 'premium' con nombre: el cupo de menus y
-- la posicion de precio. La busqueda destacada ya toma cualquier plan de paga
-- vigente (`plan <> 'basico'`) y no cambia. Los numeros tienen que coincidir
-- con `PLANES` en lib/planes.js.

create or replace function public.menus_incluidos(rid uuid)
returns integer
language sql
stable
set search_path to 'public'
as $function$
  select case
    -- Un plan de paga vencido vuelve a basico solo. Si no, bastaria con dejar
    -- de pagar para conservar los treinta menus para siempre.
    when r.plan = 'basico' then 5
    when r.premium_until is not null and r.premium_until <= now() then 5
    when r.plan = 'plus' then 10
    when r.plan = 'premium' then 30
    when r.plan = 'pedidos' then 100
    else 5
  end
  from public.restaurants r
  where r.id = rid;
$function$;

comment on function public.menus_incluidos(uuid) is
  'Menus que caben en el plan vigente del restaurante: 5 basico, 10 plus, 30 premium, 100 pedidos.';

-- Igual que la que habia; solo cambia el candado: Premium o Pedidos.
create or replace function public.posicion_de_precio(rid uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  yo record;
  mi_mediana numeric;
  mis_platillos integer;
  minimo integer := public.minimo_para_agregar();
  zona_n integer; zona_mediana numeric; zona_nivel text; zona_nombre text;
  cocina_n integer; cocina_mediana numeric; cocina_nombre text;
begin
  if not public.owns_restaurant(rid) then
    raise exception 'no_es_tuyo' using errcode = 'insufficient_privilege';
  end if;
  select * into yo from public.restaurants where id = rid;
  if yo.plan not in ('premium', 'pedidos') or (yo.premium_until is not null and yo.premium_until <= now()) then
    raise exception 'solo_premium' using errcode = 'insufficient_privilege';
  end if;

  select percentile_cont(0.5) within group (order by mi.price_cents), count(*)
    into mi_mediana, mis_platillos
  from public.menu_items mi
  join public.menus m on m.id = mi.menu_id and m.is_visible
  where mi.restaurant_id = rid and mi.price_cents is not null and mi.price_cents > 0;

  -- La colonia; si no llega, la ciudad.
  zona_nivel := 'colonia';
  zona_nombre := yo.neighborhood;
  with medianas as (
    select percentile_cont(0.5) within group (order by mi.price_cents) as mediana
    from public.menu_items mi
    join public.menus m on m.id = mi.menu_id and m.is_visible
    join public.restaurants r on r.id = mi.restaurant_id and r.status = 'publicado'
    where r.id <> rid and mi.price_cents is not null and mi.price_cents > 0
      and yo.neighborhood is not null
      and unaccent(lower(coalesce(r.neighborhood, ''))) = unaccent(lower(yo.neighborhood))
      and unaccent(lower(r.city)) = unaccent(lower(yo.city))
    group by r.id
  )
  select count(*), percentile_cont(0.5) within group (order by mediana) into zona_n, zona_mediana from medianas;

  if coalesce(zona_n, 0) < minimo then
    zona_nivel := 'ciudad';
    zona_nombre := yo.city;
    with medianas as (
      select percentile_cont(0.5) within group (order by mi.price_cents) as mediana
      from public.menu_items mi
      join public.menus m on m.id = mi.menu_id and m.is_visible
      join public.restaurants r on r.id = mi.restaurant_id and r.status = 'publicado'
      where r.id <> rid and mi.price_cents is not null and mi.price_cents > 0
        and unaccent(lower(r.city)) = unaccent(lower(yo.city))
      group by r.id
    )
    select count(*), percentile_cont(0.5) within group (order by mediana) into zona_n, zona_mediana from medianas;
  end if;

  -- La cocina: los de la ciudad que comparten alguna categoria conmigo.
  select string_agg(c.name, ' · ' order by c.name) into cocina_nombre
  from public.restaurant_cuisines rc join public.cuisines c on c.id = rc.cuisine_id
  where rc.restaurant_id = rid;

  with medianas as (
    select percentile_cont(0.5) within group (order by mi.price_cents) as mediana
    from public.menu_items mi
    join public.menus m on m.id = mi.menu_id and m.is_visible
    join public.restaurants r on r.id = mi.restaurant_id and r.status = 'publicado'
    where r.id <> rid and mi.price_cents is not null and mi.price_cents > 0
      and unaccent(lower(r.city)) = unaccent(lower(yo.city))
      and exists (
        select 1 from public.restaurant_cuisines a
        join public.restaurant_cuisines b on b.cuisine_id = a.cuisine_id
        where a.restaurant_id = rid and b.restaurant_id = r.id
      )
    group by r.id
  )
  select count(*), percentile_cont(0.5) within group (order by mediana) into cocina_n, cocina_mediana from medianas;

  return jsonb_build_object(
    'mi_mediana', case when mis_platillos > 0 then round(mi_mediana) end,
    'mis_platillos', coalesce(mis_platillos, 0),
    'minimo', minimo,
    'zona', jsonb_build_object(
      'nivel', zona_nivel,
      'nombre', zona_nombre,
      'n', coalesce(zona_n, 0),
      'mediana', case when coalesce(zona_n, 0) >= minimo then round(zona_mediana) end
    ),
    'cocina', jsonb_build_object(
      'nombre', cocina_nombre,
      'n', coalesce(cocina_n, 0),
      'mediana', case when coalesce(cocina_n, 0) >= minimo then round(cocina_mediana) end
    )
  );
end;
$function$;
