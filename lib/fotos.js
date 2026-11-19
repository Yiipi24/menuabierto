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
const COMPARTIR = catalogar("compartir");

/** La foto de una categoría, o null si esa categoría todavía no tiene. */
export function fotoCocina(slug) {
  return CATEGORIAS.get(slug)?.ruta ?? null;
}

/** La foto del encabezado, o null. Se llama `portada/hero`. */
export function fotoEncabezado() {
  return PORTADA.get("hero")?.ruta ?? null;
}

/**
 * Los atributos del <img> del encabezado: los anchos `hero-<ancho>` que deja
 * `scripts/generar-portada.mjs`, en srcset. Sin variantes, la foto sola; sin
 * foto, null.
 */
export function propsEncabezado() {
  const base = fotoEncabezado();
  if (!base) return null;

  const variantes = [...PORTADA.entries()]
    .map(([nombre, v]) => [Number(/^hero-(\d+)$/.exec(nombre)?.[1]), v.ruta])
    .filter(([ancho]) => Number.isFinite(ancho))
    .sort((a, b) => a[0] - b[0]);
  if (!variantes.length) return { src: base };

  // En un celular el encabezado va lavado con un velo crema y debajo del
  // buscador: no hace falta la foto a la densidad completa de la pantalla, y
  // es lo primero que se pinta (el LCP de la portada). Los 360px le piden al
  // navegador unos 960 de ancho en una pantalla de densidad 2.6, en vez de
  // los 1280 que pediría con 100vw (#82).
  return {
    src: variantes[Math.floor((variantes.length - 1) / 2)][1],
    srcSet: variantes.map(([ancho, ruta]) => `${ruta} ${ancho}w`).join(", "),
    sizes: "(max-width: 600px) 360px, 100vw",
  };
}

/**
 * La imagen con la que se comparte el sitio cuando la página no tiene una
 * propia: la portada de WhatsApp, de Facebook o de X.
 *
 * Se llama `compartir/og` y, si no está, se cae a la foto del encabezado. Lo
 * ideal es dejar ahí un JPG o un PNG de 1200×630: es la medida que esperan las
 * redes, y WhatsApp —por donde se comparte casi todo aquí— no siempre dibuja
 * un WebP.
 */
export function fotoCompartir() {
  return COMPARTIR.get("og")?.ruta ?? fotoEncabezado();
}
