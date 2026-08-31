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

# Correos de autenticación

Las plantillas de `templates/` reemplazan las de fábrica de Supabase, que
llegan en inglés y sin logo. `config.toml` las conecta con su asunto para el
entorno local; en el proyecto hospedado hay que pegarlas en
**Authentication → Emails → Templates** (una pestaña por plantilla, con su
asunto) porque el panel guarda el HTML en su propia base, no en el repo.

- El logo se enlaza como PNG absoluto (`https://menuabierto.com/logo-email.png`,
  generado desde `public/logo.svg`). Gmail y Outlook no dibujan SVG ni rutas
  relativas dentro de un correo.
- Todo el estilo va en atributos `style` en línea y sobre tablas: los clientes
  de correo ignoran las hojas de estilo y muchos ignoran flex y grid.
- Se mantiene `{{ .ConfirmationURL }}` también en texto plano abajo, para
  quien tenga los botones bloqueados.

El workflow `plantillas-correo.yml` las aplica solo: cada push a `main` que
toque `templates/` o `config.toml` llama a la Management API con el secret
`SUPABASE_ACCESS_TOKEN` del repo.

Ese secret tiene que ser un **legacy token** de Supabase. Los tokens con
alcance por proyecto no sirven aquí: su capability *Auth Config: read-write*
cubre el `GET` de la config y los endpoints de SSO y third-party-auth, pero no
el `PATCH /v1/projects/{ref}/config/auth`, que es el que escribe las
plantillas. Se intentó y responde 403. Como el legacy token da acceso a toda
la cuenta, conviene renovarlo con vencimiento corto en lugar de dejarlo
abierto un año. El repo es la fuente de verdad;
si alguien edita una plantilla en el panel, el siguiente push la pisa. Para
revisar sin enviar nada: `python3 scripts/aplicar-plantillas-correo.py
--dry-run`.
