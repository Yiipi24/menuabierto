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

// El degradado con el que se dibuja una categoría —o una tarjeta— mientras no
// haya foto. Sale de una suma de los caracteres del slug, así que es siempre
// el mismo para la misma categoría: "tacos" no cambia de color entre el
// mosaico y la tarjeta, ni entre una visita y otra.
//
// No hay una tabla escrita a mano de categoría a color a propósito: el
// catálogo crece desde la consola, y una categoría nueva tiene que verse bien
// el día que alguien la inserte, sin pasar por aquí.
const TONOS = [
  "linear-gradient(150deg, #e3b463, #c9752f)",
  "linear-gradient(150deg, #e9a13c, #c1451f)",
  "linear-gradient(150deg, #e0876b, #8e3b2c)",
  "linear-gradient(150deg, #d9b48c, #8a5a37)",
  "linear-gradient(150deg, #efc4a6, #c05a4a)",
  "linear-gradient(150deg, #c98a4b, #6f3320)",
];

export function tonoCocina(slug) {
  if (!slug) return TONOS[0];
  let suma = 0;
  for (const letra of slug) suma += letra.codePointAt(0);
  return TONOS[suma % TONOS.length];
}
