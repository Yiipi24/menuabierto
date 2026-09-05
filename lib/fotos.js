import { readdirSync } from "node:fs";
import { join } from "node:path";

// Las fotos que no son de un restaurante en concreto —las de las categorías y
// la del encabezado— viven en /public y no en la base: son las mismas para
// todo el país, no las sube ningún dueño y no cambian entre visitas.
//
// La carpeta se lee una vez al arrancar y no en cada petición: son diez
// archivos que solo cambian con un despliegue, y preguntarle al disco por cada
// visita sería pagar un `readdir` por persona que entra.
//
// Que el archivo falte no es un error: la portada se dibuja igual con el
// degradado cálido de su categoría. Así el directorio funciona hoy, sin fotos,
// y se enriquece el día que se agreguen sin tocar una línea de código.
const EXTENSIONES = [".avif", ".webp", ".jpg", ".jpeg", ".png"];

function catalogar(carpeta) {
  const mapa = new Map();
  let archivos = [];
  try {
    archivos = readdirSync(join(process.cwd(), "public", carpeta));
  } catch {
    return mapa;
  }

  for (const archivo of archivos) {
    const punto = archivo.lastIndexOf(".");
    if (punto < 1) continue;
    const nombre = archivo.slice(0, punto);
    const extension = archivo.slice(punto).toLowerCase();
    if (!EXTENSIONES.includes(extension)) continue;
    // El orden de EXTENSIONES manda: si alguien deja el .jpg y el .avif del
    // mismo platillo, gana el formato que pesa menos.
    const puesta = mapa.get(nombre);
    if (!puesta || EXTENSIONES.indexOf(extension) < EXTENSIONES.indexOf(puesta.ext)) {
      mapa.set(nombre, { ruta: `/${carpeta}/${archivo}`, ext: extension });
    }
  }
  return mapa;
}

const CATEGORIAS = catalogar("categorias");
const PORTADA = catalogar("portada");

/** La foto de una categoría, o null si esa categoría todavía no tiene. */
export function fotoCocina(slug) {
  return CATEGORIAS.get(slug)?.ruta ?? null;
}

/** La foto del encabezado, o null. Se llama `portada/hero`. */
export function fotoEncabezado() {
  return PORTADA.get("hero")?.ruta ?? null;
}
