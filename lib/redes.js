// Catálogo de redes. El valor guardado es el slug; el dominio sirve para
// completar el enlace cuando el dueño pega solo su usuario.
export const REDES = [
  { slug: "instagram", nombre: "Instagram", dominio: "instagram.com" },
  { slug: "facebook", nombre: "Facebook", dominio: "facebook.com" },
  { slug: "tiktok", nombre: "TikTok", dominio: "tiktok.com" },
  { slug: "whatsapp", nombre: "WhatsApp", dominio: "wa.me" },
  { slug: "x", nombre: "X (Twitter)", dominio: "x.com" },
  { slug: "youtube", nombre: "YouTube", dominio: "youtube.com" },
  { slug: "ubereats", nombre: "Uber Eats", dominio: "ubereats.com" },
  { slug: "rappi", nombre: "Rappi", dominio: "rappi.com.mx" },
  { slug: "didi", nombre: "DiDi Food", dominio: "didi-food.com" },
  { slug: "otra", nombre: "Otra", dominio: "" },
];

const POR_SLUG = new Map(REDES.map((r) => [r.slug, r]));

export function redValida(slug) {
  return POR_SLUG.has(slug);
}

export function nombreDeRed(slug) {
  return POR_SLUG.get(slug)?.nombre ?? "Enlace";
}

// Sin esquema el enlace se resuelve contra menuabierto.com y no lleva a ningún
// lado. Es la misma regla que ya se aplica al sitio web.
export function conEsquema(url) {
  const limpio = String(url ?? "").trim();
  if (!limpio) return null;
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}
