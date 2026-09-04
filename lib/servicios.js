// Lo que el local ofrece además de la comida. Hoy es uno solo —el
// estacionamiento, que es lo que se pregunta antes de salir de casa— pero se
// guarda como catálogo y no como un `has_parking` para que el siguiente
// (terraza, wifi, área de niños) sea una línea aquí y no otra columna.
//
// Mismo trato que las formas de pago: catálogo cerrado, compartido por el
// formulario del panel y la ficha pública.
export const SERVICIOS = [
  {
    slug: "estacionamiento",
    nombre: "Estacionamiento",
    pista: "Hay dónde dejar el carro",
  },
];

const POR_SLUG = new Map(SERVICIOS.map((s) => [s.slug, s]));

export function servicioValido(slug) {
  return POR_SLUG.has(slug);
}

export function nombreDeServicio(slug) {
  return POR_SLUG.get(slug)?.nombre ?? "Servicio";
}

// La columna es un arreglo de texto, es decir, lo que sea que haya en la base.
// Se limpia una vez, y en el orden del catálogo, para que dos fichas con los
// mismos servicios se lean igual.
export function serviciosDe(valor) {
  if (!Array.isArray(valor)) return [];
  const marcados = new Set(valor.map((v) => String(v ?? "").trim()));
  return SERVICIOS.filter((s) => marcados.has(s.slug)).map((s) => s.slug);
}

export function detallesDeServicio(slugs) {
  return serviciosDe(slugs).map((slug) => POR_SLUG.get(slug));
}
