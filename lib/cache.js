import { revalidatePath, revalidateTag } from "next/cache";
import { rutaFicha } from "./slug";

/**
 * La caché de lo público, y cómo se tira.
 *
 * Una ficha se lee miles de veces y se escribe cuando el dueño se acuerda. Con
 * `force-dynamic` cada visita pagaba el recorrido completo a la base —diez
 * consultas para armar la ficha, y otras diez para armar su `<title>`—, y un
 * restaurante con tráfico de mediodía era diez mil viajes que devolvían
 * exactamente lo mismo.
 *
 * Así que lo público se guarda y se recalcula cada hora. Pero una hora es
 * demasiado para el dueño que acaba de subir el precio del ribeye y recarga la
 * ficha para verlo: por eso cada cosa guardada lleva su etiqueta, y quien
 * escribe la tira. La hora es el techo, no la espera.
 */

// El techo. Pasada la hora, la primera visita se lleva el recálculo y las
// demás siguen viendo lo guardado mientras tanto.
export const VIGENCIA_FICHA = 3600;

// Las traducciones de dirección —el código del QR y los slugs viejos— cambian
// todavía menos: solo cuando una ficha cambia de nombre o deja de publicarse.
export const VIGENCIA_RUTAS = 86400;

// Una etiqueta por ficha: al guardar una no se tira la de las demás.
export function tagFicha(slug) {
  return `ficha:${slug}`;
}

// Una sola para todas las traducciones de dirección. Son dos consultas
// diminutas y separarlas por código de QR no ahorraría nada.
export const TAG_RUTAS = "rutas";

/**
 * Lo que el dueño acaba de cambiar se ve en la siguiente carga.
 *
 * Va la etiqueta —que es la que de verdad guarda los datos— y también la ruta,
 * porque la ficha y su carta son páginas distintas y las dos leen lo mismo.
 */
export function invalidarFicha(slug) {
  const limpio = String(slug ?? "").trim();
  if (!limpio) return;

  revalidateTag(tagFicha(limpio));
  revalidatePath(rutaFicha(limpio));
}

/**
 * Publicar, ocultar o borrar una ficha mueve dos cosas más: a dónde llevan el
 * QR y los enlaces viejos, y qué anuncia el sitemap. Un restaurante que se
 * publica quiere estar en Google hoy, no dentro de una hora.
 */
export function invalidarRutas() {
  revalidateTag(TAG_RUTAS);
  revalidatePath("/sitemap.xml");
}
