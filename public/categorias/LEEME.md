# Las fotos de las categorías

Cada archivo se llama como el `slug` de la categoría en la tabla `cuisines`, con
cualquiera de estas extensiones: `.avif`, `.webp`, `.jpg`, `.jpeg`, `.png`. Si
hay varias del mismo platillo gana la que pese menos, en ese orden.

    tacos.jpg      ->  la categoría "Tacos"
    pizza.webp     ->  la categoría "Pizza"

Que falte una no rompe nada: esa categoría se dibuja con el degradado cálido
que le toca (`tonoCocina` en `app/cocinas.js`) y su ícono. Por eso se pueden ir
agregando de una en una.

Se recortan a 640×420 aproximadamente, que es el doble del tamaño en que se
ven; más grande solo hace esperar a quien entra con datos móviles.

La foto del encabezado va en `public/portada/hero.jpg` (o `.webp`, `.avif`) y
conviene que sea horizontal y con aire en el centro, porque encima cae el
título y la barra de búsqueda.

**Licencia:** aquí solo entran fotos que se puedan usar —propias, compradas, o
de banco con licencia libre— y conviene anotar en el mensaje del commit de
dónde salió cada una.
