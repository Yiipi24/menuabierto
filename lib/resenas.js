// Respuestas y reportes de reseñas: lo que no habla con la base.
//
// El dueño contesta una vez por reseña y puede corregirse; cualquiera con
// cuenta —menos el autor— puede reportar una, y la reseña reportada no se
// esconde sola: queda en cola hasta que alguien la revise a mano. No hay
// moderación automática a propósito.

export const MAX_RESPUESTA = 1000;
export const MAX_DETALLE = 500;

export const MOTIVOS = [
  { slug: "falsa", nombre: "Es falsa", pista: "Esa persona no estuvo aquí, o habla de otro lugar." },
  { slug: "ofensiva", nombre: "Es ofensiva", pista: "Insultos, amenazas o datos personales." },
  { slug: "spam", nombre: "Es publicidad", pista: "Promociona otro negocio o un enlace." },
  { slug: "otra", nombre: "Otra cosa", pista: "Cuéntanos en el detalle." },
];

const MOTIVO_POR_SLUG = new Map(MOTIVOS.map((m) => [m.slug, m]));

export function motivoValido(slug) {
  return MOTIVO_POR_SLUG.has(String(slug ?? ""));
}

export function motivoDe(slug) {
  return MOTIVO_POR_SLUG.get(String(slug ?? "")) ?? null;
}

/**
 * La respuesta del dueño, limpia. Vacía es "quitar la respuesta", que es
 * válido; demasiado larga es un error con mensaje.
 */
export function leerRespuesta(bruto) {
  const texto = String(bruto ?? "").replace(/\r\n/g, "\n").trim();
  if (texto.length > MAX_RESPUESTA) {
    return { error: `La respuesta es demasiado larga. Máximo ${MAX_RESPUESTA} caracteres.` };
  }
  return { texto: texto || null };
}

// El fragmento de una reseña para un aviso o una lista: la primera línea,
// recortada, sin dejar una palabra a medias.
export function extractoDe(texto, max = 120) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.lastIndexOf(" ", max);
  return `${limpio.slice(0, corte > max / 2 ? corte : max)}…`;
}

// Cómo se lee un aviso de reseña en la bandeja.
export function textoDeAviso(aviso) {
  const estrellas = aviso.review_rating
    ? `${aviso.review_rating} ${aviso.review_rating === 1 ? "estrella" : "estrellas"}`
    : null;
  if (aviso.kind === "resena") {
    return {
      titulo: `${aviso.review_author ?? "Alguien"} te dejó ${estrellas ?? "una reseña"} en ${aviso.restaurant_name}.`,
      detalle: aviso.review_excerpt || null,
      href: `/panel/${aviso.restaurant_id}/resenas`,
    };
  }
  if (aviso.kind === "insignia") {
    return {
      titulo: `Ganaste una insignia por tus reseñas.`,
      detalle: null,
      href: "/panel/insignias",
    };
  }
  if (aviso.kind === "respuesta") {
    return {
      titulo: `${aviso.restaurant_name} respondió a tu reseña.`,
      detalle: aviso.review_excerpt || null,
      href: `/${aviso.restaurant_slug}#resenas`,
    };
  }
  return null;
}
