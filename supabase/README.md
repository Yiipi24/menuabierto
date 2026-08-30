# Base de datos

El esquema vive en `migrations/`, con el mismo nombre y orden que tiene el
proyecto de Supabase (`bpvtydaoiscvxpidwmif`). Cada archivo ya fue aplicado.

## Reglas

- **Nunca edites una migración ya aplicada.** Escribe una nueva que corrija.
- Toda tabla nueva nace con RLS activo y sus políticas en la misma migración.
  Una tabla sin políticas queda invisible, que es el fallo seguro correcto.
- Después de cambiar el esquema, revisa los advisors de seguridad y
  rendimiento de Supabase antes de dar el trabajo por terminado.

## Decisiones que conviene no reabrir a la ligera

- **`location` es `geography(point, 4326)`**, no dos columnas de latitud y
  longitud. Con el índice GiST, `ST_DWithin` resuelve "cerca de mí" contra un
  directorio grande; filtrar en JavaScript no escala más allá de un pueblo.
- **`owner_id` y `created_by` son distintos.** `created_by` es quien cargó la
  ficha; `owner_id` es el dueño que la reclamó. Una ficha que cargamos
  nosotros tiene `owner_id` nulo y debe mostrarse como *no reclamada*, nunca
  como si el restaurante la hubiera publicado.
- **Los precios son enteros en centavos.** En punto flotante terminan
  mostrando 89.99000001.
- **Las políticas usan `(select auth.uid())`**, no `auth.uid()` suelto: así
  Postgres lo evalúa una vez por consulta en lugar de una vez por fila.
- **Nada de `upsert` ni `ON CONFLICT` bajo RLS** si no quieres una política de
  `SELECT`: Postgres necesita leer la fila en conflicto para resolverlos.

## Avisos aceptados a propósito

- `spatial_ref_sys` sin RLS: es una tabla de sistema de PostGIS con el
  catálogo de sistemas de coordenadas. No contiene datos nuestros y no somos
  sus dueños.
- PostGIS, `unaccent` y `pg_trgm` instalados en el esquema `public`: moverlos
  rompería las referencias existentes a cambio de nada.
