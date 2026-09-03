// Los límites viven aquí porque los usan los dos lados: el navegador, para
// avisar antes de mandar nada, y la acción de servidor, que es la que manda.
// Tienen que quedar por debajo del `serverActions.bodySizeLimit` de
// next.config.js: si un archivo pasa ese tope, Next corta la petición antes de
// que nuestra validación exista y la página se cae entera.
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
export const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024;

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const TIPOS_ARCHIVO_MENU = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function mb(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// Devuelve el aviso a mostrar, o null si los archivos pasan. Se revisa en el
// navegador para no gastar la subida entera en algo que va a rebotar.
export function revisarArchivos(archivos, { tipos, maxBytes, queEs }) {
  for (const archivo of archivos) {
    if (!tipos.includes(archivo.type)) {
      return `"${archivo.name}" no es un formato que aceptemos.`;
    }
    if (archivo.size > maxBytes) {
      return `"${archivo.name}" pesa más de ${mb(maxBytes)}. Comprime ${queEs} o sube uno más ligero.`;
    }
  }
  return null;
}
