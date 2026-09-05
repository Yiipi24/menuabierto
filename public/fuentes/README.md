# Las letras que se sirven desde aquí

Se sirven desde aquí y no desde Google Fonts: una carta se abre en la mesa,
muchas veces con mala señal, y una petición a otro dominio antes de que se vea
la primera letra es la que se atora. Además así nadie pasa por un tercero para
leer un menú.

Cada archivo es solo el subconjunto latino, que es el que usan los menús en
español.

| Archivo | Letra | Dónde se usa | Licencia |
| --- | --- | --- | --- |
| `bricolage-latin.woff2` | Bricolage Grotesque 400–800 | Títulos, botones, navegación y nombres de restaurante en todo el sitio | OFL 1.1 — `LICENCIA-bricolage-grotesque-ofl-1.1.txt` |
| `yellowtail-latin.woff2` | Yellowtail | Títulos de la opción "Manuscrita" (el pizarrón) | Apache 2.0 — `LICENCIA-yellowtail-apache-2.0.txt` |
| `oswald-latin.woff2` | Oswald 400–600 | Títulos, secciones, platillos y precios de la opción "Condensada" | OFL 1.1 — `LICENCIA-oswald-ofl-1.1.txt` |

Bricolage es la única que baja todo el mundo, porque es la del sitio; las otras
dos solo las pide quien abre un menú con esa plantilla. El texto corrido no usa
ninguna: va con la letra del sistema, que ya está en el aparato.

Para actualizarlas, pídele a Google Fonts el CSS con un navegador moderno
(`https://fonts.googleapis.com/css2?family=Yellowtail&display=swap`) y baja el
`.woff2` del bloque `/* latin */`. La de Bricolage se pide con el eje de peso
acotado y el óptico fijo, que es lo que la deja en 40 KB:
`css2?family=Bricolage+Grotesque:opsz,wght@14,400..800&display=swap`.
