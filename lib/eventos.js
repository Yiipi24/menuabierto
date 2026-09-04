// Los eventos que mide el panel. La lista vive aquí y no en la pantalla ni en
// la ruta que los recibe porque los tres tienen que estar de acuerdo: el enum
// `restaurant_event` de la base es esta misma lista.
export const EVENTOS = [
  "restaurant_view",
  "qr_scan",
  "phone_click",
  "directions_click",
  "restaurant_save",
  "menu_view",
  "social_click",
  "website_click",
];

// Las cuatro fuentes que el panel sabe pintar (enum `traffic_source`).
export const FUENTES = ["busqueda", "qr", "redes", "directo"];

export const COOKIE_VISITANTE = "ma_visitante";

// Medio año: suficiente para no contar dos veces a quien vuelve el mes que
// viene, y poco para que la cookie no se vuelva un rastro permanente.
export const DIAS_COOKIE = 180;

export function eventoValido(valor) {
  return EVENTOS.includes(valor);
}

export function fuenteValida(valor) {
  return FUENTES.includes(valor) ? valor : "directo";
}

// Dominios que cuentan como "redes sociales". Se compara por sufijo para que
// `m.facebook.com` y `l.instagram.com` entren igual.
const REDES = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "t.co",
  "whatsapp.com",
  "linkedin.com",
  "youtube.com",
  "pinterest.com",
  "threads.net",
];

export function fuenteDeReferente(referente, propioHost) {
  if (!referente) return "directo";
  let host;
  try {
    host = new URL(referente).hostname.toLowerCase();
  } catch {
    return "directo";
  }
  // Venir de otra página del propio sitio significa que la persona llegó por
  // el buscador o el directorio de Menú Abierto.
  if (propioHost && (host === propioHost || host.endsWith(`.${propioHost}`))) {
    return "busqueda";
  }
  if (REDES.some((r) => host === r || host.endsWith(`.${r}`))) return "redes";
  // Un buscador externo o un enlace pegado en un chat son, para el dueño, lo
  // mismo: alguien que llegó con el enlace en la mano.
  return "directo";
}
