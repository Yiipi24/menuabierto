// Las plantillas son cómo se ve el menú en la ficha pública. El contenido es
// el mismo — secciones, platillos, precios — y cambiar de plantilla no toca
// ni un dato: solo la clase con la que se pinta.
//
// Los slugs tienen que coincidir con el `check` de `menus.template`.
export const PLANTILLAS = [
  {
    slug: "clasica",
    nombre: "Clásica",
    descripcion: "Lista sobria, el precio a la derecha. Sirve para casi todo.",
  },
  {
    slug: "pizarra",
    nombre: "Pizarra",
    descripcion: "Fondo oscuro y letras claras, como el menú de la pared.",
  },
  {
    slug: "elegante",
    nombre: "Elegante",
    descripcion: "Tipografía con serifa y mucho aire. Para carta de noche.",
  },
  {
    slug: "compacta",
    nombre: "Compacta",
    descripcion: "Dos columnas. Cabe una carta larga sin tanto scroll.",
  },
];

export const PLANTILLA_POR_DEFECTO = "clasica";

const SLUGS = new Set(PLANTILLAS.map((p) => p.slug));

// Una plantilla que ya no exista no debe dejar el menú sin pintar.
export function plantillaValida(slug) {
  return SLUGS.has(slug) ? slug : PLANTILLA_POR_DEFECTO;
}

export function nombreDePlantilla(slug) {
  return PLANTILLAS.find((p) => p.slug === plantillaValida(slug))?.nombre ?? "";
}
