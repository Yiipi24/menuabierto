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
- **Una ficha sin coordenadas no la esconde el radio.** `location` se quedó
  nula en todas las fichas hasta que el panel aprendió a pedirla, y mientras
  tanto exigir `location is not null` dejaba "Cerca de mí" en cero resultados.
  Sale igual en la búsqueda, pero al final, porque su distancia es nula.
  Cuando la mayoría tenga punto conviene volver a apretar esto.
- **El lugar escrito manda sobre el radio.** Buscar "Escobedo" con la ubicación
  puesta tiene que traer Escobedo, no la intersección vacía de las dos cosas.
- **El punto se calcula desde la dirección, con Nominatim (OpenStreetMap).**
  Pedirle coordenadas al dueño de un restaurante era pedirle que copiara
  números de un mapa para poder aparecer en "Cerca de mí". Los campos de
  latitud y longitud siguen ahí, plegados, y ganan si los llena: un
  geocodificador se equivoca en colonias nuevas. No se usa el de Google porque
  sus términos restringen guardar las coordenadas de forma permanente, y aquí
  el punto vive en la base; los datos de OSM son ODbL y sí se pueden almacenar
  dando atribución. Se consulta solo cuando la dirección cambió o no hay punto,
  y va al final del guardado: un servicio ajeno lento no puede dejar la ficha
  sin categorías ni horarios. `NOMINATIM_URL` apunta a otra instancia si el
  volumen crece, que es lo que su política pide.
- **El panel escribe el punto por `set_restaurant_location`**, no con un
  `update` normal: mandar EWKT en texto y confiar en el cast es más frágil que
  una función que recibe dos números y los valida. Se lee con
  `restaurant_coords`, porque PostgREST devuelve `geography` en hexadecimal.
  Las dos son `security invoker` y solo para `authenticated`.
- **`owner_id` y `created_by` son distintos.** `created_by` es quien cargó la
  ficha; `owner_id` es el dueño que la reclamó. Una ficha que cargamos
  nosotros tiene `owner_id` nulo y debe mostrarse como *no reclamada*, nunca
  como si el restaurante la hubiera publicado.
- **Los precios son enteros en centavos.** En punto flotante terminan
  mostrando 89.99000001.
- **Un restaurante tiene varios menús, no uno.** La carta, la de bebidas, la
  del día. Las secciones y los platillos cuelgan de `menus`, no del
  restaurante: antes todo caía en una sola lista y no había forma de separar
  la carta de temporada de la de siempre. `menu_sections` y `menu_items`
  conservan `restaurant_id` porque de ahí sale su RLS, y la llave hacia el
  menú es compuesta (`menu_id, restaurant_id`) para que una sección no pueda
  colgar del menú de otro restaurante.
- **Cuántos menús caben lo decide `menus_incluidos`, y lo impone un trigger.**
  5 en básico, 10 en plus, 30 en premium. Está en la base y no solo en el
  panel porque el límite tiene que sostenerse aunque alguien escriba contra
  PostgREST directamente. `lib/planes.js` repite los números para poder avisar
  antes de tiempo; si cambian, se cambian en los dos lados. Un plan de paga
  vencido cuenta como básico: si no, dejar de pagar conservaría los treinta
  menús para siempre.
- **Borrar una sección no borra sus platillos.** `section_id` queda en nulo y
  los platillos se muestran al final, sin agrupar. Por eso la coherencia entre
  platillo y sección la comprueba un trigger y no una llave compuesta: al
  borrar, esa llave pondría en nulo también `menu_id`, que es obligatorio.
- **Un menú puede ser un archivo.** `kind = 'archivo'` con el PDF o la foto en
  el bucket `menus`, para quien ya tiene su carta hecha y no quiere
  capturarla. Bucket aparte del de fotos porque este acepta PDF y aquel no.
  Lo capturado sale en las búsquedas por platillo; lo subido no, y el panel lo
  dice al elegir.
- **La búsqueda solo mira menús visibles.** Encontrar un restaurante por un
  platillo de una carta que su dueño tiene guardada manda a la ficha a buscar
  algo que no está.
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
- `cuisines_created_by_fkey` sin índice: la columna se escribe al proponer una
  categoría y no se consulta por ella; el catálogo son decenas de filas.

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
