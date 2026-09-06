import { headers } from "next/headers";

/**
 * Convierte una ruta del sitio en una dirección completa.
 *
 * El QR tiene que apuntar a un dominio, no a `/q/k2r4kwq`: quien lo escanea
 * lo hace desde otro aparato y una ruta relativa ahí no significa nada. El
 * host de la petición es el que sirve la página, así que funciona igual en
 * producción, en una vista previa y en local.
 */
export async function urlAbsoluta(ruta) {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return ruta;
  const protocolo = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}${ruta}`;
}
