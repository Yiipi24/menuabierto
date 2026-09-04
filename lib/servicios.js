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

// Cómo se paga el estacionamiento. No es otro servicio de la lista —"gratis"
// no se ofrece por su cuenta— sino la letra chica del que ya está marcado, así
// que vive aparte y solo significa algo junto a él.
export const COSTOS_ESTACIONAMIENTO = [
  { slug: "gratis", nombre: "Gratis", pista: "Gratis para los comensales" },
  {
    slug: "propina",
    nombre: "Propina voluntaria",
    pista: "Propina voluntaria para quien lo cuida",
  },
  { slug: "costo", nombre: "Tiene costo", pista: "El estacionamiento se paga aparte" },
];

const COSTO_POR_SLUG = new Map(COSTOS_ESTACIONAMIENTO.map((c) => [c.slug, c]));

// Un costo sin estacionamiento no dice nada, y contradiría a la ficha si el
// dueño desmarca el servicio y se queda el "Gratis" de antes. Se limpia aquí,
// en el mismo lugar en que se limpia todo lo demás que viene de la base.
export function costoDeEstacionamiento(valor, servicios) {
  if (!serviciosDe(servicios).includes("estacionamiento")) return null;
  return COSTO_POR_SLUG.get(String(valor ?? "").trim()) ?? null;
}

/**
 * Los servicios listos para pintar. El costo del estacionamiento llega como el
 * segundo renglón de su fila —"Gratis para los comensales"— porque es la
 * respuesta a la misma pregunta, y una etiqueta aparte partiría en dos algo
 * que se lee de corrido.
 */
export function detallesDeServicio(slugs, costoEstacionamiento) {
  const costo = costoDeEstacionamiento(costoEstacionamiento, slugs);
  return serviciosDe(slugs).map((slug) => {
    const servicio = POR_SLUG.get(slug);
    if (slug === "estacionamiento" && costo) {
      return { ...servicio, pista: costo.pista, costo: costo.slug };
    }
    return servicio;
  });
}
