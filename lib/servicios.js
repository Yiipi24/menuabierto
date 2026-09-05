// Lo que el local ofrece además de la comida: lo que se pregunta antes de
// salir de casa. El catálogo vive en la tabla `amenities` y no aquí, para que
// agregar un servicio sea un INSERT y no una migración más un despliegue.
//
// Por eso estas funciones reciben el catálogo en vez de importarlo: quien las
// llama ya lo trajo de la base. El orden es el de la tabla, y es el mismo en
// el panel y en la ficha.

// Las filas llegan como las devuelve PostgREST. Se traducen una vez, aquí,
// para que ni el formulario ni la ficha tengan que hablar en inglés.
export function catalogoDeServicios(filas) {
  if (!Array.isArray(filas)) return [];
  return filas
    .filter((f) => f?.slug)
    .map((f) => ({
      slug: f.slug,
      nombre: f.name ?? "Servicio",
      pista: f.hint ?? "",
      icono: f.icon || f.slug,
    }));
}

// La columna es un arreglo de texto, es decir, lo que sea que haya en la base.
// Se limpia una vez, y en el orden del catálogo, para que dos fichas con los
// mismos servicios se lean igual. Una clave que ya no esté en el catálogo
// desaparece sola de la ficha en vez de salir en blanco.
export function serviciosDe(catalogo, valor) {
  if (!Array.isArray(valor)) return [];
  const marcados = new Set(valor.map((v) => String(v ?? "").trim()));
  return catalogo.filter((s) => marcados.has(s.slug)).map((s) => s.slug);
}

// Si hay estacionamiento se pregunta sobre la lista cruda y no sobre el
// catálogo: es una clave suelta, la única con preguntas propias, y así estas
// dos funciones no necesitan que nadie les pase la tabla entera.
function hayEstacionamiento(servicios) {
  return (Array.isArray(servicios) ? servicios : []).some(
    (s) => String(s ?? "").trim() === "estacionamiento",
  );
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
  // El valet del local y el viene viene de la calle son la misma respuesta
  // para quien pregunta: no hay tarifa, pero se da propina. Quién la recibe ya
  // se sabe por dónde se estaciona.
  {
    slug: "propina",
    nombre: "Propina o viene viene",
    pista: "Se acostumbra dar propina a quien lo cuida",
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
  if (!hayEstacionamiento(servicios)) return null;
  return TIPO_POR_SLUG.get(String(valor ?? "").trim()) ?? null;
}

const COSTO_POR_SLUG = new Map(COSTOS_ESTACIONAMIENTO.map((c) => [c.slug, c]));

// Un costo sin estacionamiento no dice nada, y contradiría a la ficha si el
// dueño desmarca el servicio y se queda el "Gratis" de antes. Se limpia aquí,
// en el mismo lugar en que se limpia todo lo demás que viene de la base.
export function costoDeEstacionamiento(valor, servicios) {
  if (!hayEstacionamiento(servicios)) return null;
  return COSTO_POR_SLUG.get(String(valor ?? "").trim()) ?? null;
}

/**
 * Los servicios listos para pintar. El costo del estacionamiento llega como el
 * segundo renglón de su fila —"Gratis para los comensales"— porque es la
 * respuesta a la misma pregunta, y una etiqueta aparte partiría en dos algo
 * que se lee de corrido.
 */
export function detallesDeServicio(
  catalogo,
  slugs,
  costoEstacionamiento,
  modo,
  tipoEstacionamiento,
) {
  const porSlug = new Map(catalogo.map((s) => [s.slug, s]));
  const costo = costoDeEstacionamiento(costoEstacionamiento, slugs);
  const tipo = tipoDeEstacionamiento(tipoEstacionamiento, slugs);
  const servicio = modoDeServicio(modo);

  const lista = serviciosDe(catalogo, slugs).map((slug) => {
    const marcado = porSlug.get(slug);
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
  // cómodo se va a estar ya estando ahí. Su clave no sale del catálogo —no es
  // un servicio, es una respuesta— pero necesita una propia para no chocar con
  // ninguna fila al pintar la lista.
  return servicio
    ? [
        {
          slug: `modo-${servicio.slug}`,
          nombre: servicio.nombre,
          pista: servicio.pista,
          icono: servicio.icono,
        },
        ...lista,
      ]
    : lista;
}
