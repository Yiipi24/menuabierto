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

## Datos estructurados y enlaces compartidos

Cada ficha y cada carta llevan su bloque `application/ld+json`
(`lib/jsonld.js`): la ficha se declara como `Restaurant` —con su dirección, su
horario, su rango de precio, su calificación y sus últimas reseñas— y la carta
como `Menu`, con sus secciones, sus platillos y sus precios. Las dos apuntan al
mismo `@id`, así que un buscador entiende que hablan del mismo lugar. El marcado
solo dice lo que la página ya enseña.

Las mismas páginas arman sus etiquetas de Open Graph y de Twitter con
`lib/compartir.js`, para que un enlace pegado en WhatsApp llegue con la foto del
restaurante en vez de un recuadro gris. La imagen es la primera foto de la ficha
—la fachada— y, cuando no tiene ninguna, la del sitio: se deja en
`public/compartir/og.jpg` (ver `public/compartir/LEEME.md`) y, si tampoco está,
se usa la del encabezado.
