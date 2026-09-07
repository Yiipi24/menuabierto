// La dirección pública del sitio, en un solo lugar. Estaba escrita a mano en
// el layout, en el correo y en los `fallback` de los actions; el sitemap y el
// robots la necesitan otra vez, y una copia más era una copia de más: el día
// que el dominio cambie, el sitemap seguiría anunciando URLs del anterior.
//
// Se puede sobreescribir con `SITIO_URL` para levantar el sitio bajo otro
// dominio sin tocar código. La barra final se recorta porque las rutas ya
// vienen con la suya y `https://menuabierto.com//jcsmokehouse` es otra
// dirección para un buscador.
export const SITIO = String(process.env.SITIO_URL || "https://menuabierto.com").replace(/\/+$/, "");

export function urlDelSitio(ruta) {
  return `${SITIO}${ruta}`;
}

/**
 * Si este despliegue es el que debe salir en los buscadores.
 *
 * Cada rama abierta tiene su propia URL en Vercel con el sitio entero dentro.
 * Indexada, compite contra producción con el mismo contenido y se lleva
 * visitas a un despliegue que mañana ya no existe. Solo producción se deja
 * rastrear; las vistas previas se cierran enteras en `robots.txt`.
 *
 * Fuera de Vercel (local, o cualquier otro alojamiento) no hay nada que
 * distinguir, así que se trata como el sitio bueno.
 */
export function sitioIndexable() {
  const entorno = process.env.VERCEL_ENV;
  return entorno ? entorno === "production" : true;
}
