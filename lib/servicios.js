// Lo que el local ofrece además de la comida: lo que se pregunta antes de
// salir de casa. Es un catálogo y no una columna por servicio justo para esto,
// para que agregar uno sea una línea aquí.
//
// Mismo trato que las formas de pago: catálogo cerrado, compartido por el
// formulario del panel y la ficha pública. El orden es el que se ve en los
// dos lados; va primero lo que más pesa al decidir a dónde ir.
export const SERVICIOS = [
  // Va aquí y no entre las respuestas de "¿cómo se sirve?" porque no se pelea
  // con ninguna: un lugar con mesas puede además mandar a domicilio, y uno que
  // solo despacha para llevar también.
  {
    slug: "domicilio",
    nombre: "Servicio a domicilio",
    pista: "Te lo llevan a tu casa",
  },
  {
    slug: "estacionamiento",
    nombre: "Estacionamiento",
    pista: "Hay dónde dejar el carro",
  },
  {
    slug: "wifi",
    nombre: "Wifi",
    pista: "Internet para los comensales",
  },
  {
    slug: "terraza",
    nombre: "Terraza",
    pista: "Mesas al aire libre",
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

// Cómo se sirve la comida. No son casillas de la lista de arriba: las tres
// respuestas se excluyen entre sí, y como casillas nada impediría marcar "solo
// en el lugar" junto a "para llevar". Una sola respuesta, o ninguna.
export const MODOS_DE_SERVICIO = [
  {
    slug: "ambos",
    nombre: "En el lugar y para llevar",
    pista: "Hay mesas, y también puedes pedir para llevar",
    icono: "comer-aqui",
  },
  {
    slug: "solo-sitio",
    nombre: "Solo en el lugar",
    pista: "Aquí se come; no hay servicio para llevar",
    icono: "comer-aqui",
  },
  {
    slug: "solo-llevar",
    nombre: "Solo para llevar",
    pista: "No hay servicio de mesa en el local",
    icono: "para-llevar",
  },
];

const MODO_POR_SLUG = new Map(MODOS_DE_SERVICIO.map((m) => [m.slug, m]));

export function modoDeServicio(valor) {
  return MODO_POR_SLUG.get(String(valor ?? "").trim()) ?? null;
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
  {
    slug: "viene-viene",
    nombre: "Viene viene",
    pista: "Lo cuida un viene viene; se acostumbra darle propina",
  },
  { slug: "costo", nombre: "Tiene costo", pista: "El estacionamiento se paga aparte" },
];

// Dónde se deja el carro. Es otra pregunta distinta de cuánto cuesta —hay
// estacionamiento propio de paga y calle gratis— así que son dos campos y no
// una sola lista con las cuatro combinaciones.
export const TIPOS_ESTACIONAMIENTO = [
  {
    slug: "propio",
    nombre: "Estacionamiento propio",
    pista: "El local tiene su propio estacionamiento",
  },
  {
    slug: "calle",
    nombre: "Estacionamiento en la calle",
    pista: "Se estaciona en la vía pública",
  },
];

const TIPO_POR_SLUG = new Map(TIPOS_ESTACIONAMIENTO.map((t) => [t.slug, t]));

export function tipoDeEstacionamiento(valor, servicios) {
  if (!serviciosDe(servicios).includes("estacionamiento")) return null;
  return TIPO_POR_SLUG.get(String(valor ?? "").trim()) ?? null;
}

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
export function detallesDeServicio(slugs, costoEstacionamiento, modo, tipoEstacionamiento) {
  const costo = costoDeEstacionamiento(costoEstacionamiento, slugs);
  const tipo = tipoDeEstacionamiento(tipoEstacionamiento, slugs);
  const servicio = modoDeServicio(modo);

  const lista = serviciosDe(slugs).map((slug) => {
    const marcado = POR_SLUG.get(slug);
    if (slug !== "estacionamiento") return marcado;
    // Dónde se estaciona cambia el nombre de la fila y cómo se paga es su
    // segundo renglón: son dos respuestas a dos preguntas, y partirlas en dos
    // filas repetiría "Estacionamiento" dos veces seguidas.
    return {
      ...marcado,
      nombre: tipo ? tipo.nombre : marcado.nombre,
      pista: costo ? costo.pista : (tipo ? tipo.pista : marcado.pista),
      costo: costo?.slug ?? null,
      tipo: tipo?.slug ?? null,
    };
  });

  // Encabeza la lista porque decide si vale la pena ir; lo demás dice qué tan
  // cómodo se va a estar ya estando ahí.
  return servicio
    ? [{ slug: servicio.icono, nombre: servicio.nombre, pista: servicio.pista }, ...lista]
    : lista;
}
