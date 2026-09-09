// El código de `lib/` importa sin extensión (`./precios`), como lo resuelve
// Next. Node en ESM exige la extensión, así que las pruebas registran este
// gancho que se la agrega cuando el archivo existe. Solo toca las rutas
// relativas del propio repo; los paquetes siguen su camino.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(new URL("./_gancho.mjs", import.meta.url).pathname));
