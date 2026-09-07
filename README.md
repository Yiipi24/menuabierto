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
`app/sitemap.js`). El sitemap se arma con las fichas publicadas y sus cartas
visibles, y se recalcula cada hora.

Solo el despliegue de producción se deja rastrear: en una vista previa de
Vercel el `robots.txt` cierra el sitio entero para que no compita con
producción con el mismo contenido. El dominio sale de `SITIO_URL`, con
`https://menuabierto.com` por defecto.

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
