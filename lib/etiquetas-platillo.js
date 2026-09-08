// Lo que un platillo declara de sí mismo: si es vegetariano, si pica, si lleva
// gluten. El catálogo vive en la tabla `dish_labels` y no aquí, por lo mismo
// que el de servicios: agregar una etiqueta tiene que ser un INSERT y no una
// migración más un despliegue.
//
// Por eso estas funciones reciben el catálogo en vez de importarlo: quien las
// llama ya lo trajo de la base. El orden es el de la tabla, y es el mismo en el
// panel y en la carta, para que dos cartas con las mismas etiquetas se lean
// igual.

// Un alérgeno no es un distintivo: "vegano" es una promesa que el platillo
// presume y "contiene cacahuate" es una advertencia que hay que poder leer sin
// buscarla. Se pintan en dos lugares distintos y por eso se separan aquí.
export const TIPO_ALERGENO = "alergeno";

export const GRUPOS_ETIQUETA = [
  ["dieta", "Dieta", "Lo que el platillo no lleva, o cómo se preparó."],
  ["caracteristica", "Cómo es", "Lo que se pregunta antes de pedirlo."],
  [
    TIPO_ALERGENO,
    "Contiene",
    "Márcalo solo si estás seguro: quien es alérgico decide con esta línea.",
  ],
];

// Las filas llegan como las devuelve PostgREST. Se traducen una vez, aquí,
// para que ni el formulario ni la carta tengan que hablar en inglés.
export function catalogoDeEtiquetas(filas) {
  if (!Array.isArray(filas)) return [];
  return filas
    .filter((f) => f?.slug)
    .map((f) => ({
      slug: f.slug,
      nombre: f.name ?? "Etiqueta",
      pista: f.hint ?? "",
      icono: f.icon || f.slug,
      tipo: f.kind ?? "caracteristica",
    }));
}

/**
 * Las etiquetas de un platillo, listas para pintar. Se resuelven contra el
 * catálogo y en su orden: una clave repetida sale una sola vez y una que ya no
 * esté en el catálogo desaparece sola, en vez de salir en blanco.
 */
export function detallesDeEtiqueta(catalogo, valor) {
  if (!Array.isArray(valor) || !valor.length) return [];
  const marcadas = new Set(valor.map((v) => String(v ?? "").trim()));
  return catalogo.filter((e) => marcadas.has(e.slug));
}

// Los distintivos van junto al nombre del platillo; los alérgenos, en su
// renglón. Quien pinta recibe las dos listas ya partidas y no vuelve a
// preguntarse de qué tipo es cada una.
export function partirEtiquetas(etiquetas) {
  const lista = Array.isArray(etiquetas) ? etiquetas : [];
  return {
    distintivos: lista.filter((e) => e.tipo !== TIPO_ALERGENO),
    alergenos: lista.filter((e) => e.tipo === TIPO_ALERGENO),
  };
}

// Resolver las etiquetas de una lista de platillos de una sola pasada. Lo usan
// la ficha y el panel: los dos traen sus platillos de la base y los dos pintan
// la misma carta, así que el trabajo se hace una vez y del lado del servidor.
export function conEtiquetas(catalogo, platillos) {
  if (!Array.isArray(platillos)) return [];
  return platillos.map((p) => ({
    ...p,
    etiquetas: detallesDeEtiqueta(catalogo, p.labels),
  }));
}

/**
 * Lo que se puede guardar de lo que llegó del formulario: solo claves del
 * catálogo, sin repetir y en su orden. La base también lo valida con un
 * trigger, pero ahí una clave inventada es una excepción; aquí, simplemente no
 * se guarda.
 */
export function etiquetasValidas(catalogo, valores) {
  return detallesDeEtiqueta(catalogo, valores).map((e) => e.slug);
}

// El renglón de alérgenos escrito: "Contiene: gluten, lácteos y huevo". En
// minúsculas porque va dentro de una frase, no como título.
export function fraseDeAlergenos(alergenos) {
  const nombres = (alergenos ?? []).map((a) => a.nombre.toLocaleLowerCase("es"));
  if (!nombres.length) return "";
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}
