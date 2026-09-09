# Menú Abierto

Landing de lanzamiento de [menuabierto.com](https://menuabierto.com) — cartas
digitales por QR para restaurantes.

Next.js 15 (App Router), sin dependencias externas. Se despliega en Vercel en
cada push a `main`.

## Desarrollo

```bash
npm install
npm run dev
```

## Pruebas, CI y monitoreo

```bash
npm test          # unitarias, con node:test; no necesitan red ni llaves
npm run lint      # eslint con las reglas de Next y de React
npm run test:e2e  # Playwright contra el sitio construido (npm run build antes)
```

Las unitarias cubren la lógica que decide dinero y direcciones: `lib/precios`,
`lib/slug`, `lib/planes`, `lib/cobro`, `lib/cupones`, `lib/whatsapp`, los
catálogos y las métricas. Viven en `tests/unitarias/` y corren con el `node
--test` de Node 22, sin framework: el único truco es `_resolver.mjs`, que le
agrega la extensión a los `import "./precios"` que Next resuelve solo.

Las de extremo a extremo (`tests/e2e/`) visitan lo que no puede romperse:
portada y búsqueda, una ficha publicada tomada del sitemap y su carta, el
panel mandando a `/entrar`, las páginas de `/comida`, y que el webhook de cobro
rechace lo que no viene firmado. Necesitan `SUPABASE_URL` y
`SUPABASE_PUBLISHABLE_KEY` porque las fichas son reales; con `BASE_URL` apuntan
a un despliegue en vez de levantar uno.

El workflow `ci.yml` corre lint, unitarias y build en cada push y pull request.
Las de extremo a extremo corren después, solo si el repo tiene esas dos llaves
como secretos; si no, el job avisa y se salta en vez de fallar.

Los errores de producción salen por `instrumentation.js` (`onRequestError`,
todo lo que revienta en el servidor) y por `app/error.js` (lo que revienta en
el navegador, vía `POST /api/errores`). Los dos pasan por `lib/errores.js`, que
los deja en el log de Vercel y, si existe `ERRORES_WEBHOOK_URL`, los manda a
un webhook de Slack o Discord, que es el lugar donde alguien los lee. Del lado
del comensal, `@vercel/analytics` en el layout cuenta páginas y orígenes sin
cookies; hay que encender Web Analytics en el proyecto de Vercel para que
empiece a guardar.

## Cobro de los planes

Plus y Premium se cobran con **Mercado Pago**, por suscripción mensual y por
restaurante, no por cuenta. Se eligió por cobertura en México —tarjeta, OXXO y
SPEI—; Stripe queda como alternativa y por eso `subscriptions.provider` existe
como columna.

El flujo:

1. En `/panel/planes` el dueño toca "Contratar Plus". La acción
   (`app/panel/planes/actions.js`) crea la suscripción en Mercado Pago
   (`/preapproval`) con `external_reference = <restaurante>:<plan>`, guarda la
   fila en `subscriptions` como pendiente y lo manda al `init_point` a pagar.
2. Al pagar vuelve a `/panel/planes/volver?preapproval_id=…`, que sincroniza en
   el momento para que vea su plan sin esperar al webhook.
3. Mercado Pago avisa por webhook a `POST /api/cobro/webhook` cada vez que la
   suscripción cambia (`subscription_preapproval`,
   `subscription_authorized_payment`). Se verifica la firma `x-signature`
   (HMAC-SHA256 sobre `id:…;request-id:…;ts:…;`, con tolerancia de cinco
   minutos), y el aviso solo sirve de timbre: el estado se le pide a la API y
   se escribe con `lib/suscripciones.js`. Procesarlo dos veces deja la base
   igual que una.
4. La regla del plan está en `estadoDesdeSuscripcion` (`lib/cobro.js`) y tiene
   pruebas: `authorized` sube el plan hasta el siguiente cobro más siete días
   de gracia; `paused` (cobro rechazado) conserva la vigencia que ya había y
   la base degrada sola al vencer; `cancelled` respeta lo pagado y nada más.
   Nunca se borra nada: los menús de más quedan guardados y ocultos.

El plan solo lo escribe la llave de servicio. Un trigger
(`plan_solo_desde_el_cobro`) rechaza cualquier cambio de `plan` o
`premium_until` que venga de `anon` o `authenticated`: antes bastaba un PATCH
con la llave publicable para ponerse Premium.

Variables de entorno: `MP_ACCESS_TOKEN` (de la aplicación de Mercado Pago; el
de prueba sirve para el sandbox), `MP_WEBHOOK_SECRET` (el secreto que da el
panel de webhooks al registrar la URL), `SUPABASE_SERVICE_ROLE_KEY` (solo en el
servidor), y opcionalmente `PRECIO_PLUS_MXN` y `PRECIO_PREMIUM_MXN` para mover
los precios sin desplegar (por defecto 199 y 399). Sin `MP_ACCESS_TOKEN` la
página de planes enseña los botones deshabilitados y no se puede contratar.

Queda fuera, a propósito: la factura fiscal (CFDI), que Mercado Pago no emite
por nosotros, y un panel de cobranza propio. La página lo dice.

## Lista de espera

El formulario hace `POST /api/waitlist`. Hoy la ruta valida el correo y lo
registra en los logs de Vercel; cuando exista la base de datos hay que
sustituir ese punto por la escritura real.

## Indexación

`/robots.txt` y `/sitemap.xml` se generan desde la app (`app/robots.js` y
`app/sitemap.js`). El sitemap se arma con las fichas publicadas, sus cartas
visibles y las páginas por tipo de comida y por zona, y se recalcula cada
hora.

### Páginas por tipo de comida y por zona

Nadie busca "Menú Abierto": busca "tacos en Coyoacán". Esa búsqueda ya existía
—`/?cocina=tacos&lugar=Coyoacán`— pero vivía en la query, y una dirección con
query no es una página que un buscador indexe ni que alguien comparta. Ahora
tiene la suya:

- `/comida` — el índice: los tipos de comida que tienen restaurante y las zonas
  con más.
- `/comida/[cocina]` — `/comida/tacos`.
- `/comida/[cocina]/[zona]` — `/comida/tacos/coyoacan`.

Cada una reusa `search_restaurants`, tiene su `<h1>`, su texto, su metadata, su
JSON-LD de `ItemList` con migas, y enlaces cruzados a las zonas vecinas y a las
otras cocinas de la zona, que es por donde un rastreador recorre el directorio
sin depender del sitemap.

**Solo existen las que tienen contenido.** El catálogo (`lib/zonas.js`) se arma
con los restaurantes publicados: una combinación con menos de
`MINIMO_POR_PAGINA` restaurantes ni se genera —devuelve 404— ni entra en el
sitemap. Publicar todas las combinaciones posibles de cocina por colonia son
miles de páginas vacías, y eso tiene nombre (*doorway pages*) y castigo.

La zona se escribe con guiones (`gral-escobedo`), al revés que el slug de una
ficha, que va pegado porque el dueño lo dicta por teléfono. `comida` es desde
ahora un segmento reservado, en `lib/slug.js` y en la base.

La portada filtrada, en cambio, lleva `noindex, follow`: enseña lo mismo que la
página de zona, y las dos compitiendo por la misma búsqueda es el sitio
partiéndose la fuerza en dos. La portada sin filtros se indexa igual, y los
enlaces de la búsqueda se siguen.

Solo el despliegue de producción se deja rastrear: en una vista previa de
Vercel el `robots.txt` cierra el sitio entero para que no compita con
producción con el mismo contenido. El dominio sale de `SITIO_URL`, con
`https://menuabierto.com` por defecto.

## Caché e invalidación

Las páginas públicas ya no se declaran `force-dynamic`. La ficha y la carta se
siguen resolviendo en cada visita —leen la sesión para saber si quien mira es
el dueño—, pero lo caro dejó de viajar con ellas: todo lo que la ficha enseña y
solo cambia cuando el dueño lo cambia se guarda en la caché de datos, por slug,
con una vigencia de una hora (`lib/cache.js`).

Una hora es el techo, no la espera. Cada ficha guardada lleva su etiqueta
(`ficha:<slug>`) y quien escribe la tira: guardar el restaurante, subir o
borrar una foto, tocar una carta, publicar una reseña. El dueño que sube el
precio del ribeye recarga y lo ve.

Dos cosas se quedan fuera a propósito:

- **"Abierto ahora"** se pregunta en cada visita. Es lo único de la ficha que
  cambia sin que nadie la toque, y guardarlo una hora mandaría a alguien a un
  local cerrado.
- **Historias, publicaciones y seguidores** salen de `_social/datos`, que
  depende de quién esté mirando y por eso no se guarda. El número de seguidores
  que enseña la ficha sí viaja en lo guardado, así que puede ir hasta una hora
  por detrás: es el único dato de la página al que se le permite ese retraso.

Las páginas de `/comida` van por el mismo camino: el catálogo de cocinas y
zonas se guarda un día y la lista de cada página una hora, las dos bajo la
etiqueta `rutas`, así que un rastreador recorriendo doscientas zonas no cuesta
doscientas búsquedas. Ahí las tarjetas no enseñan "Abierto ahora": es lo único
que cambia sin que nadie lo toque, y guardado una hora mandaría a alguien a un
local cerrado. La búsqueda de la portada, que se resuelve en cada visita, lo
sigue enseñando.

Las traducciones de dirección —el código del QR y los slugs viejos de `/r/`—
se guardan un día bajo la etiqueta `rutas`, junto con el sitemap. Publicar,
ocultar o borrar una ficha las tira: un restaurante que se publica quiere estar
en Google hoy.

## Pedir por WhatsApp

El restaurante ya toma pedidos por ahí. Lo que no tenía era forma de decirlo en
su ficha ni de recibir la lista escrita, así que el pedido llegaba como
"quiero dos hamburguesas de las que vi" y el dueño preguntaba tres veces qué
eran.

El dueño lo prende en su panel con un número —casi nunca es el teléfono de la
ficha, que suele ser el fijo del local— y una línea de letra chica: el mínimo,
hasta dónde entregan, a qué hora cierra la cocina. Es lo que se pregunta por
chat, y preguntarlo es donde se cae un pedido.

Con eso, la ficha enseña un botón junto a "Abierto ahora" y la carta se vuelve
tocable: cada platillo tiene su `+`, abajo aparece una barra con la cuenta, y
"Enviar por WhatsApp" abre el chat con el mensaje ya escrito —los platillos,
sus cantidades, el total y el enlace de la carta—. Una carta de archivo (un PDF
o una foto) no se puede tocar platillo por platillo, así que ahí el botón abre
el chat a secas.

**Aquí no se cobra nada.** No hay carrito guardado, ni pedido en la base, ni
pasarela: lo que sale es texto, y quien confirma, prepara y cobra sigue siendo
el restaurante. El total viaja diciendo que es aproximado, porque los precios
de la carta pueden ir hasta una hora por detrás de la cocina y un número que el
local no confirmó no puede presentarse como la cuenta. El pedido a medias que
nadie contestó no queda "pendiente" en ningún lado, porque no existe en ningún
lado.

El tablero cuenta dos cosas distintas: `whatsapp_click`, tocar el botón, y
`whatsapp_order`, mandar el pedido armado desde la carta. La distancia entre
las dos es lo único que dice si la carta digital está vendiendo o solo
consultándose. La tarjeta del panel enseña la segunda.

El número se guarda normalizado —solo dígitos y con lada, como lo quiere
`wa.me`— en `lib/whatsapp.js`, que es donde el panel lo valida, la ficha arma
el enlace y la carta arma el mensaje. Diez dígitos son mexicanos y se les pone
el 52; el `1` viejo de los celulares se quita solo. Apagar el interruptor no
borra el número: apagarlo un martes no debería costar volver a teclearlo el
miércoles.

## Datos estructurados y enlaces compartidos

Cada ficha y cada carta llevan su bloque `application/ld+json`
(`lib/jsonld.js`): la ficha se declara como `Restaurant` —con su dirección, su
horario, su rango de precio, su calificación y sus últimas reseñas— y la carta
como `Menu`, con sus secciones, sus platillos y sus precios. Las dos apuntan al
mismo `@id`, así que un buscador entiende que hablan del mismo lugar. El marcado
solo dice lo que la página ya enseña.

Un restaurante que toma pedidos declara además su `OrderAction`, que apunta al
mismo chat con el mismo mensaje que el botón: la regla de esa hoja es que el
marcado no diga nada que la página no enseñe.

Las mismas páginas arman sus etiquetas de Open Graph y de Twitter con
`lib/compartir.js`, para que un enlace pegado en WhatsApp llegue con la foto del
restaurante en vez de un recuadro gris. La imagen es la primera foto de la ficha
—la fachada— y, cuando no tiene ninguna, la del sitio: se deja en
`public/compartir/og.jpg` (ver `public/compartir/LEEME.md`) y, si tampoco está,
se usa la del encabezado.
