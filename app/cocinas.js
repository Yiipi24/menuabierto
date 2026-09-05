// Un ícono por categoría. Los chips sin nada al lado se leen como una lista de
// palabras; con el ícono se reconocen de un vistazo, que es justo lo que hace
// alguien que todavía no sabe qué se le antoja.
const ICONOS = {
  tacos: "🌮",
  mariscos: "🦐",
  "comida-corrida": "🥘",
  antojitos: "🫓",
  parrilla: "🔥",
  pizza: "🍕",
  hamburguesas: "🍔",
  sushi: "🍣",
  china: "🥡",
  italiana: "🍝",
  vegetariana: "🥗",
  desayunos: "☕",
  postres: "🍰",
  pollo: "🍗",
  birria: "🍲",
  tortas: "🥪",
  bbq: "🍖",
  cortes: "🥩",
  coreana: "🍜",
  arabe: "🧆",
  espanola: "🫒",
  peruana: "🐟",
  argentina: "🥩",
  india: "🍛",
  thai: "🍤",
  bar: "🍺",
  saludable: "🥑",
  "sin-gluten": "🌾",
};

export function iconoCocina(slug) {
  return ICONOS[slug] ?? "🍴";
}

// El color de la loseta de cada categoría. El mosaico de la portada y las
// tarjetas sin foto se pintan con la paleta de la talavera, y no con un color
// por categoría escrito a mano: el catálogo crece desde la consola, y una
// categoría nueva tiene que verse bien el día que alguien la inserte, sin
// pasar por aquí.
//
// El tono sale de una suma de los caracteres del slug, así que es siempre el
// mismo para la misma categoría: "tacos" no cambia de color entre una visita y
// otra ni entre el mosaico y la tarjeta.
const TONOS = [
  "#1b4e9b", // azul cobalto
  "#0c6b6b", // verde azulado
  "#8a2f5c", // vino
  "#1f6d3f", // verde nopal
  "#a8500f", // ocre quemado
  "#3b3f8f", // añil
];

export function tonoCocina(slug) {
  if (!slug) return TONOS[0];
  let suma = 0;
  for (const letra of slug) suma += letra.codePointAt(0);
  return TONOS[suma % TONOS.length];
}
