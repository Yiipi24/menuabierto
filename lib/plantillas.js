// Una plantilla es cómo se ve la carta en la página pública. El contenido es
// el mismo —secciones, platillos, precios— y cambiar de plantilla no toca ni
// un dato: solo la clase con la que se pinta y unas cuantas variables de CSS.
//
// Todas enseñan lo mismo arriba: el nombre del menú, el del restaurante y lo
// que lo distingue. Lo que cambia es el traje.
//
// Los slugs tienen que coincidir con el `check` de `menus.template`.

// Los ajustes que puede mover el dueño. Cada catálogo es una lista cerrada:
// lo que llegue de la base y no esté aquí cae al valor de la plantilla, así
// que un jsonb con basura nunca deja la carta sin pintar.

export const PALETAS = [
  { slug: "ladrillo", nombre: "Ladrillo", acento: "#c2410c", suave: "#fff1e7" },
  { slug: "ambar", nombre: "Ámbar", acento: "#d6a15f", suave: "#fdf3e5" },
  { slug: "vino", nombre: "Vino", acento: "#9f1239", suave: "#ffe6ec" },
  { slug: "bosque", nombre: "Bosque", acento: "#15803d", suave: "#e8f6ed" },
  { slug: "oceano", nombre: "Océano", acento: "#0e7490", suave: "#e3f4f7" },
  { slug: "tinta", nombre: "Tinta", acento: "#292524", suave: "#f0ede8" },
];

export const TIPOGRAFIAS = [
  { slug: "moderna", nombre: "Moderna", ejemplo: "Sin serifa, la de siempre" },
  { slug: "clasica", nombre: "Clásica", ejemplo: "Con serifa, de carta de noche" },
  { slug: "condensada", nombre: "Condensada", ejemplo: "Angosta, cabe más en la línea" },
  { slug: "manuscrita", nombre: "Manuscrita", ejemplo: "Títulos a mano, como en el pizarrón" },
];

export const DENSIDADES = [
  { slug: "comoda", nombre: "Cómoda", descripcion: "Más aire entre platillos." },
  { slug: "apretada", nombre: "Apretada", descripcion: "Cabe más sin tanto scroll." },
];

export const COLUMNAS = [
  { slug: "una", nombre: "Una columna", descripcion: "Se lee de corrido en el teléfono." },
  { slug: "dos", nombre: "Dos columnas", descripcion: "Para cartas largas, en pantalla grande." },
];

export const PLANTILLAS = [
  {
    slug: "pizarron",
    nombre: "Pizarrón",
    descripcion: "El menú de la pared: fondo de tiza, marco de madera y precios grandes.",
    base: {
      paleta: "ambar",
      tipografia: "manuscrita",
      densidad: "comoda",
      columnas: "una",
      destacados: true,
      iconos: true,
      marco: true,
    },
  },
  {
    slug: "clasica",
    nombre: "Clásica",
    descripcion: "Lista sobria con línea punteada hasta el precio. Sirve para casi todo.",
    base: {
      paleta: "ladrillo",
      tipografia: "moderna",
      densidad: "comoda",
      columnas: "una",
      destacados: true,
      iconos: false,
      marco: false,
    },
  },
  {
    slug: "pizarra",
    nombre: "Pizarra",
    descripcion: "Fondo oscuro y letras claras, sin marco. Para cartas cortas.",
    base: {
      paleta: "ambar",
      tipografia: "condensada",
      densidad: "comoda",
      columnas: "una",
      destacados: true,
      iconos: true,
      marco: false,
    },
  },
  {
    slug: "elegante",
    nombre: "Elegante",
    descripcion: "Serifa, centrado y mucho aire. Para carta de noche.",
    base: {
      paleta: "tinta",
      tipografia: "clasica",
      densidad: "comoda",
      columnas: "una",
      destacados: true,
      iconos: false,
      marco: false,
    },
  },
  {
    slug: "compacta",
    nombre: "Compacta",
    descripcion: "Dos columnas y platillos en fichas. Cabe una carta larga.",
    base: {
      paleta: "bosque",
      tipografia: "moderna",
      densidad: "apretada",
      columnas: "dos",
      destacados: true,
      iconos: true,
      marco: false,
    },
  },
];

export const PLANTILLA_POR_DEFECTO = "clasica";

const SLUGS = new Set(PLANTILLAS.map((p) => p.slug));

// Una plantilla que ya no exista no debe dejar el menú sin pintar.
export function plantillaValida(slug) {
  return SLUGS.has(slug) ? slug : PLANTILLA_POR_DEFECTO;
}

export function plantillaDe(slug) {
  return PLANTILLAS.find((p) => p.slug === plantillaValida(slug));
}

export function nombreDePlantilla(slug) {
  return plantillaDe(slug)?.nombre ?? "";
}

function enCatalogo(catalogo, valor) {
  return catalogo.some((o) => o.slug === valor) ? valor : null;
}

function siONo(valor, porDefecto) {
  return typeof valor === "boolean" ? valor : porDefecto;
}

// Lo que se guardó puede ser cualquier cosa: jsonb sin forma, ajustes de una
// plantilla anterior, `null`. Aquí sale siempre un objeto completo, y lo que
// no se reconozca vuelve al ajuste de la plantilla.
export function estiloDeMenu(template, style) {
  const base = plantillaDe(template).base;
  const s = style && typeof style === "object" && !Array.isArray(style) ? style : {};

  return {
    paleta: enCatalogo(PALETAS, s.paleta) ?? base.paleta,
    tipografia: enCatalogo(TIPOGRAFIAS, s.tipografia) ?? base.tipografia,
    densidad: enCatalogo(DENSIDADES, s.densidad) ?? base.densidad,
    columnas: enCatalogo(COLUMNAS, s.columnas) ?? base.columnas,
    destacados: siONo(s.destacados, base.destacados),
    iconos: siONo(s.iconos, base.iconos),
    marco: siONo(s.marco, base.marco),
  };
}

// Solo el pizarrón tiene marco de madera; en las demás la perilla no significa
// nada y el panel no la enseña.
export function admiteMarco(template) {
  return plantillaValida(template) === "pizarron";
}

// El contraste de WCAG entre dos colores "#rrggbb": de 1 (iguales) a 21
// (negro sobre blanco). El texto normal pide 4.5.
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

function mezclar(hex, hacia, t) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16);
        return Math.round(c + (hacia - c) * t)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

/**
 * El color más parecido a `color` que se lee sobre todos los `fondos`: se
 * oscurece si los fondos son claros y se aclara si son oscuros, de a poco,
 * hasta llegar al contraste mínimo. Si ya se lee, vuelve igual.
 */
export function colorLegible(color, fondos, minimo = 4.5) {
  const hacia = luminancia(fondos[0]) > 0.4 ? 0 : 255;
  for (let paso = 0; paso <= 50; paso++) {
    const candidato = mezclar(color, hacia, paso / 50);
    if (fondos.every((f) => contraste(candidato, f) >= minimo)) return candidato;
  }
  return hacia === 0 ? "#000000" : "#ffffff";
}

// Los fondos donde el acento va como texto: la carta clara (blanco o papel),
// el tono suave de las etiquetas y el pizarrón. Tienen que coincidir con
// `--paper` y con `--carta-fondo` de `.carta-pizarron` en globals.css.
export const FONDOS_CLAROS = ["#ffffff", "#fdfaf5"];
export const FONDO_PIZARRON = "#17130f";

// El color viaja como variable de CSS y no como una clase por paleta: así
// agregar un color es una línea en la lista de arriba.
//
// El acento de la paleta es el que se ve en adornos y barras. Como texto (el
// precio, la etiqueta, el título de la sección) va su versión legible: el
// ámbar sobre papel o la tinta sobre el pizarrón no se leerían. La carta
// elige cuál de las dos según su fondo (`--menu-acento-texto`).
export function variablesDeEstilo(estilo) {
  const paleta = PALETAS.find((p) => p.slug === estilo.paleta) ?? PALETAS[0];
  return {
    "--menu-acento": paleta.acento,
    "--menu-acento-suave": paleta.suave,
    "--menu-acento-en-claro": colorLegible(paleta.acento, [...FONDOS_CLAROS, paleta.suave]),
    "--menu-acento-en-oscuro": colorLegible(paleta.acento, [FONDO_PIZARRON]),
  };
}

export function clasesDeCarta(template, estilo) {
  const plantilla = plantillaValida(template);
  return [
    "carta",
    `carta-${plantilla}`,
    `carta-letra-${estilo.tipografia}`,
    `carta-aire-${estilo.densidad}`,
    estilo.columnas === "dos" ? "carta-dos-columnas" : "carta-una-columna",
    estilo.marco && admiteMarco(plantilla) ? "carta-con-marco" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
