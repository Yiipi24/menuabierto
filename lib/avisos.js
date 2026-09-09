// Avisos por push: lo que no habla con el navegador ni con la base.
//
// Qué tipos de aviso existen, cómo se leen las preferencias de una persona y
// qué texto lleva cada aviso cuando sale como notificación. `lib/push.js` es
// el que manda; esto se prueba sin llaves.

import { textoDeAviso } from "./resenas";
import { insigniaPorSlug } from "./insignias";

export const TIPOS_DE_AVISO = [
  {
    slug: "historia",
    nombre: "Historias",
    pista: "Cuando un restaurante que sigues con la campana publica una historia.",
  },
  {
    slug: "resena",
    nombre: "Reseñas de tu restaurante",
    pista: "Cuando un comensal califica una ficha tuya.",
  },
  {
    slug: "respuesta",
    nombre: "Respuestas a tus reseñas",
    pista: "Cuando el dueño contesta una reseña que escribiste.",
  },
  {
    slug: "insignia",
    nombre: "Insignias",
    pista: "Cuando ganas una insignia por tus reseñas.",
  },
];

const SLUGS = new Set(TIPOS_DE_AVISO.map((t) => t.slug));

// Las preferencias tal como se guardan: solo llaves conocidas, y solo `false`
// significa algo. Lo que falta está encendido.
export function prefsDe(crudo) {
  const prefs = {};
  const objeto = crudo && typeof crudo === "object" ? crudo : {};
  for (const t of TIPOS_DE_AVISO) {
    prefs[t.slug] = objeto[t.slug] !== false;
  }
  return prefs;
}

// Lo que se manda a la base desde el formulario: las apagadas, y nada más,
// para que una llave nueva que se agregue mañana nazca encendida.
export function prefsParaGuardar(formulario) {
  const guardar = {};
  for (const t of TIPOS_DE_AVISO) {
    if (formulario?.[t.slug] === false) guardar[t.slug] = false;
  }
  return guardar;
}

export function pushPermitido(prefs, kind) {
  if (!SLUGS.has(kind)) return false;
  return prefsDe(prefs)[kind];
}

/**
 * El texto de la notificación: título corto, cuerpo de una línea y a dónde
 * lleva. La misma frase que la bandeja, para que no digan cosas distintas.
 */
export function textoDePush(aviso) {
  if (aviso.kind === "historia") {
    return {
      titulo: aviso.restaurant_name ?? "Menú Abierto",
      cuerpo: "Publicó una historia. Dura 24 horas.",
      url: `/${aviso.restaurant_slug}`,
      tag: `historia-${aviso.post_id ?? aviso.restaurant_id}`,
    };
  }
  if (aviso.kind === "insignia") {
    const insignia = insigniaPorSlug(aviso.badge_slug);
    return {
      titulo: insignia ? `Ganaste la insignia ${insignia.nombre}` : "Ganaste una insignia",
      cuerpo: insignia?.lema ?? "Gracias por reseñar.",
      url: "/panel/insignias",
      tag: `insignia-${aviso.badge_slug}`,
    };
  }
  const resena = textoDeAviso(aviso);
  if (!resena) return null;
  return {
    titulo: resena.titulo,
    cuerpo: resena.detalle ? `“${resena.detalle}”` : "",
    url: resena.href,
    tag: `${aviso.kind}-${aviso.review_id ?? aviso.id}`,
  };
}

// La suscripción que manda el navegador, comprobada antes de guardarla.
export function suscripcionValida(sub) {
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\/.{10,1990}$/.test(endpoint)) return null;
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{10,100}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}
