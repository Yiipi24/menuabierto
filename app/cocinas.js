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
