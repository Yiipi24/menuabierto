-- Las estadisticas de pedidos del plan Pedidos: cuantos llegaron, cuanto se
-- vendio, el ticket promedio, lo que mas se pide, a que hora y como.
--
-- Se agrega aqui y no en la app: PostgREST devuelve mil filas como mucho y
-- corta sin avisar, y un local con mucho movimiento pasa de mil pedidos en un
-- trimestre. La funcion corre con los permisos de quien la llama (security
-- invoker), asi que la RLS de `orders` ya deja ver solo los pedidos propios:
-- para cualquier otro restaurante devuelve ceros.
--
-- Lo vendido y el ticket son de referencia, como el total del pedido: salen
-- de los precios de la carta en el momento, y quien cobra es el local. Los
-- cancelados se cuentan aparte y no suman.
create function public.estadisticas_de_pedidos(rid uuid, dias integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  -- Una zona vacia o mal escrita haria fallar la consulta entera; se queda
  -- la del centro, como en el resto de la ficha.
  with zona as (
    select coalesce(
      (select r.timezone
       from public.restaurants r
       join pg_catalog.pg_timezone_names z on z.name = r.timezone
       where r.id = rid),
      'America/Mexico_City'
    ) as tz
  ),
  pedidos as (
    select o.*
    from public.orders o
    where o.restaurant_id = rid
      and o.created_at >= now() - make_interval(days => least(greatest(coalesce(dias, 30), 1), 365))
  ),
  validos as (
    select * from pedidos where status <> 'cancelado'
  ),
  platillos as (
    -- Se lee cada renglon como lo pinta el panel (`lineasGuardadas`): sin
    -- nombre no cuenta, y una cantidad que no es un numero positivo vale 1.
    -- Un renglon raro no debe tumbar las estadisticas de todo el periodo.
    select
      btrim(i ->> 'name') as nombre,
      -- El `::numeric` va dentro de un `then`, que solo se evalua si su
      -- `when` se cumple; dentro de un `and` el orden no esta garantizado.
      sum(case
            when jsonb_typeof(i -> 'quantity') = 'number'
              or (i ->> 'quantity') ~ '^[0-9]{1,6}(\.[0-9]{1,6})?$'
              then case when (i ->> 'quantity')::numeric > 0 then (i ->> 'quantity')::numeric else 1 end
            else 1
          end) as cantidad
    from validos v
    cross join lateral jsonb_array_elements(v.items) as i
    where nullif(btrim(i ->> 'name'), '') is not null
    group by 1
    order by 2 desc, 1
    limit 5
  ),
  horas as (
    select extract(hour from v.created_at at time zone (select tz from zona))::int as hora, count(*) as n
    from validos v
    group by 1
    order by 2 desc, 1
    limit 3
  ),
  entregas as (
    select coalesce(v.delivery, 'sin_dato') as entrega, count(*) as n
    from validos v
    group by 1
  )
  select jsonb_build_object(
    'dias', least(greatest(coalesce(dias, 30), 1), 365),
    'pedidos', (select count(*) from pedidos),
    'entregados', (select count(*) from pedidos where status = 'entregado'),
    'cancelados', (select count(*) from pedidos where status = 'cancelado'),
    'abiertos', (select count(*) from pedidos where status in ('nuevo', 'aceptado', 'listo')),
    'vendido_cents', (select coalesce(sum(total_cents), 0) from validos),
    'con_total', (select count(*) from validos where total_cents is not null),
    'ticket_promedio_cents', (select round(avg(total_cents)) from validos where total_cents is not null),
    'platillos', coalesce((select jsonb_agg(jsonb_build_object('nombre', nombre, 'cantidad', cantidad) order by cantidad desc, nombre) from platillos), '[]'::jsonb),
    'horas', coalesce((select jsonb_agg(jsonb_build_object('hora', hora, 'pedidos', n) order by n desc, hora) from horas), '[]'::jsonb),
    'entregas', coalesce((select jsonb_object_agg(entrega, n) from entregas), '{}'::jsonb)
  );
$$;

comment on function public.estadisticas_de_pedidos(uuid, integer) is
  'Resumen de los pedidos de un restaurante en los ultimos N dias (1 a 365). Security invoker: la RLS de orders limita a los propios.';

revoke execute on function public.estadisticas_de_pedidos(uuid, integer) from public, anon;
grant execute on function public.estadisticas_de_pedidos(uuid, integer) to authenticated;
