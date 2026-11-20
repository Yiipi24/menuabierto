// Las fotos que suben los dueños y los comensales se guardan tal cual: un PNG
// de celular pesa más de un mega, y servirlo así en una ficha tardaba más de
// veinte segundos en 4G (#82). El almacenamiento de Supabase las redimensiona
// al vuelo: la misma ruta bajo /render/image/ en vez de /object/ devuelve la
// foto al ancho pedido y, si el navegador lo acepta, en WebP o AVIF. Así se
// arreglan también las fotos que ya estaban subidas, sin volver a subir nada.
//
// Supabase no agranda: pedir 1440 de una foto de 861 px devuelve los 861, así
// que un ancho de más en el srcset no cuesta nada.
//
// Lo que no viene del almacenamiento (las fotos de /public, la vista previa
// de un archivo recién elegido) pasa sin tocar.

const PUBLICA = "/storage/v1/object/public/";
const TRANSFORMADA = "/storage/v1/render/image/public/";

export const ANCHOS = [480, 960, 1440];
export const CALIDAD = 70;

export function esDelAlmacenamiento(url) {
  return typeof url === "string" && url.includes(PUBLICA);
}

export function urlTransformada(url, ancho, calidad = CALIDAD) {
  if (!esDelAlmacenamiento(url)) return url;
  const u = new URL(url.replace(PUBLICA, TRANSFORMADA));
  u.searchParams.set("width", String(ancho));
  u.searchParams.set("quality", String(calidad));
  return u.toString();
}

/**
 * Los atributos de un <img> para una foto: `src`, y `srcSet` y `sizes` cuando
 * hay más de un ancho. `sizes` dice qué tan ancha se ve la foto en la página;
 * sin él, el navegador asume que ocupa toda la pantalla.
 */
export function propsDeFoto(url, { anchos = ANCHOS, calidad = CALIDAD, sizes } = {}) {
  if (!url) return {};
  if (!esDelAlmacenamiento(url)) return { src: url };

  const lista = [...new Set(anchos)].sort((a, b) => a - b);
  if (lista.length === 1) return { src: urlTransformada(url, lista[0], calidad) };

  // El src es para el navegador que no entiende srcset: el ancho de en medio
  // se ve bien en un celular y no pesa de más en una computadora.
  const respaldo = lista[Math.floor((lista.length - 1) / 2)];
  return {
    src: urlTransformada(url, respaldo, calidad),
    srcSet: lista.map((a) => `${urlTransformada(url, a, calidad)} ${a}w`).join(", "),
    ...(sizes ? { sizes } : {}),
  };
}
