// El catálogo de iconos de platillo y la corazonada que los adivina. Vive
// aparte de los dibujos porque lo usan tres lados: el formulario del panel, la
// acción del servidor que valida lo que llega y la carta pública. Los dibujos
// son JSX y no tienen por qué viajar hasta la validación.

// El orden es el del menú desplegable: primero lo que más se pide.
export const ICONOS_PLATILLO = [
  ["hamburguesa", "Hamburguesa"],
  ["carne", "Carne / brisket"],
  ["cerdo", "Cerdo / pulled pork"],
  ["pollo", "Pollo"],
  ["parrilla", "Parrilla / ahumado"],
  ["taco", "Tacos"],
  ["burrito", "Burrito / wrap"],
  ["sandwich", "Sándwich / torta"],
  ["pizza", "Pizza"],
  ["pescado", "Pescado"],
  ["camaron", "Camarón / mariscos"],
  ["ensalada", "Ensalada"],
  ["sopa", "Sopa / caldo"],
  ["papas", "Papas / botana"],
  ["queso", "Queso"],
  ["huevo", "Huevos / desayuno"],
  ["pan", "Pan"],
  ["picante", "Picante / salsa"],
  ["fruta", "Fruta"],
  ["postre", "Postre"],
  ["helado", "Helado"],
  ["cafe", "Café"],
  ["bebida", "Bebida / refresco"],
  ["cerveza", "Cerveza"],
  ["coctel", "Cóctel / vino"],
  ["cubiertos", "Platillo (genérico)"],
];

const SLUGS = new Set(ICONOS_PLATILLO.map(([slug]) => slug));

export const ICONO_GENERICO = "cubiertos";
export const SIN_ICONO = "ninguno";

export function iconoPlatilloValido(slug) {
  return slug === SIN_ICONO || SLUGS.has(slug);
}

function sinAcentos(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Las pistas van de lo más específico a lo más general: "pastel de carne" es
// carne y no postre, así que "carne" tiene que poder ganarle a "pastel". Se
// resuelve por posición en el texto —gana la palabra que aparece primero— y,
// en empate, por el orden de esta lista.
const PISTAS = [
  ["hamburguesa", ["hamburguesa", "burger", "cheeseburger", "smash"]],
  ["cerdo", ["pulled pork", "cerdo", "puerco", "carnitas", "cochinita", "chicharron", "tocino", "costilla", "rib"]],
  ["carne", ["brisket", "arrachera", "res", "bistec", "rib eye", "ribeye", "steak", "barbacoa", "birria", "asado", "suadero", "milanesa"]],
  ["pollo", ["pollo", "alitas", "alas", "pechuga", "chicken", "pavo"]],
  ["parrilla", ["parrilla", "ahumad", "bbq", "asador", "brasa", "carbon"]],
  ["taco", ["taco", "gringa", "quesabirria", "quesadilla"]],
  ["burrito", ["burrito", "wrap", "enchilada", "chilaquil", "tamal"]],
  ["sandwich", ["sandwich", "torta", "baguette", "bagel", "club"]],
  ["pizza", ["pizza", "calzone", "focaccia"]],
  ["pescado", ["pescado", "salmon", "atun", "tilapia", "mojarra", "ceviche", "sushi"]],
  ["camaron", ["camaron", "marisco", "pulpo", "ostion", "callo", "aguachile", "coctel de camaron"]],
  ["ensalada", ["ensalada", "salad", "verdura", "vegetal", "nopal"]],
  ["sopa", ["sopa", "caldo", "crema de", "pozole", "menudo", "ramen", "consome"]],
  ["papas", ["papas", "fries", "nachos", "botana", "aros", "totopos", "guacamole"]],
  ["queso", ["queso", "gratin", "fondue"]],
  ["huevo", ["huevo", "omelet", "desayuno", "molletes", "hot cake", "hotcake"]],
  ["pan", ["pan ", "bolillo", "concha", "croissant", "baguet", "telera"]],
  ["picante", ["salsa", "picante", "chile", "habanero", "adobo"]],
  ["fruta", ["fruta", "manzana", "fresa", "mango", "platano", "sandia", "coctel de fruta"]],
  ["postre", ["postre", "pastel", "flan", "pay", "brownie", "cheesecake", "churro", "galleta", "gelatina"]],
  ["helado", ["helado", "nieve", "malteada", "frappe"]],
  ["cafe", ["cafe", "capuchino", "cappuccino", "latte", "espresso", "americano", "chocolate caliente"]],
  ["bebida", ["agua", "refresco", "limonada", "jugo", "licuado", "soda", "te ", "horchata", "bebida"]],
  ["cerveza", ["cerveza", "chela", "michelada", "beer", "lager", "ipa"]],
  ["coctel", ["coctel", "margarita", "mezcal", "tequila", "vino", "copa", "mojito", "sangria", "whisky"]],
];

// Adivinar el icono del nombre es lo que hace que esto no dé trabajo: el dueño
// captura "Burger brisket" y ya trae dibujo. Si no reconoce nada, el genérico.
export function sugerirIcono(nombre) {
  const texto = ` ${sinAcentos(nombre)} `;
  let mejor = null;

  PISTAS.forEach(([slug, palabras], orden) => {
    palabras.forEach((palabra) => {
      const donde = texto.indexOf(sinAcentos(palabra));
      if (donde === -1) return;
      if (!mejor || donde < mejor.donde || (donde === mejor.donde && orden < mejor.orden)) {
        mejor = { slug, donde, orden };
      }
    });
  });

  return mejor?.slug ?? ICONO_GENERICO;
}

// El icono que se pinta: el que eligió el dueño, o el que se adivina. Nulo
// cuando pidió que ese platillo no llevara ninguno.
export function iconoDePlatillo(platillo) {
  const guardado = platillo?.icon;
  if (guardado === SIN_ICONO) return null;
  if (iconoPlatilloValido(guardado)) return guardado;
  return sugerirIcono(platillo?.name);
}

