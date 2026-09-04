# Las dos letras de las plantillas

Se sirven desde aquí y no desde Google Fonts: una carta se abre en la mesa,
muchas veces con mala señal, y una petición a otro dominio antes de que se vea
la primera letra es la que se atora. Además así nadie pasa por un tercero para
leer un menú.

Cada archivo es solo el subconjunto latino, que es el que usan los menús en
español. Entre las dos suman menos de 40 KB, y el navegador solo baja la que
la plantilla de ese menú realmente use.

| Archivo | Letra | Dónde se usa | Licencia |
| --- | --- | --- | --- |
| `yellowtail-latin.woff2` | Yellowtail | Títulos de la opción "Manuscrita" (el pizarrón) | Apache 2.0 — `LICENCIA-yellowtail-apache-2.0.txt` |
| `oswald-latin.woff2` | Oswald 400–600 | Títulos, secciones, platillos y precios de la opción "Condensada" | OFL 1.1 — `LICENCIA-oswald-ofl-1.1.txt` |

Para actualizarlas, pídele a Google Fonts el CSS con un navegador moderno
(`https://fonts.googleapis.com/css2?family=Yellowtail&display=swap`) y baja el
`.woff2` del bloque `/* latin */`.
