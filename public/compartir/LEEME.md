# La imagen para compartir

Va aquí y se llama `og`, con cualquiera de estas extensiones: `.avif`,
`.webp`, `.jpg`, `.jpeg`, `.png`.

    public/compartir/og.jpg

Es la que sale cuando alguien pega un enlace del sitio en WhatsApp, en
Facebook o en X **y la página no tiene una foto propia**. Las fichas casi
siempre la tienen —la fachada del restaurante— así que esta se ve sobre todo
en la portada, en el explorador y en las fichas todavía sin fotos.

Conviene que mida 1200×630 y que sea JPG o PNG: es lo que esperan las redes, y
WhatsApp no siempre dibuja un WebP.

Si no está, se usa la foto del encabezado (`public/portada/hero`), y si esa
tampoco está, el enlace se comparte sin imagen.

**Licencia:** aquí solo entran fotos que se puedan usar —propias, compradas, o
de banco con licencia libre— y conviene anotar en el mensaje del commit de
dónde salió.
