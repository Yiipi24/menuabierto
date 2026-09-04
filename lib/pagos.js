// Cómo se paga la cuenta es de las tres cosas que más se preguntan por
// teléfono, junto con el horario y la dirección. El catálogo vive aquí, y no
// junto a los iconos, porque lo comparten los dos lados: el formulario del
// panel (cliente) y la ficha pública (servidor).
//
// Es un catálogo cerrado y no texto libre para que la ficha pueda decir
// "acepta tarjeta" sin tener que interpretar "sí manejamos plástico".
export const FORMAS_DE_PAGO = [
  {
    slug: "efectivo",
    nombre: "Efectivo",
    pista: "Pago en caja o en la mesa",
  },
  {
    slug: "tarjeta-credito",
    nombre: "Tarjeta de crédito",
    pista: "Visa, Mastercard, American Express",
  },
  {
    slug: "tarjeta-debito",
    nombre: "Tarjeta de débito",
    pista: "Con terminal en el local",
  },
  {
    slug: "transferencia",
    nombre: "Transferencia",
    pista: "SPEI o depósito a cuenta",
  },
  {
    slug: "sin-contacto",
    nombre: "Pago sin contacto",
    pista: "Apple Pay, Google Pay o tarjeta NFC",
  },
];

export const MAX_FORMAS_DE_PAGO = FORMAS_DE_PAGO.length;

const POR_SLUG = new Map(FORMAS_DE_PAGO.map((f) => [f.slug, f]));

export function pagoValido(slug) {
  return POR_SLUG.has(slug);
}

export function nombreDePago(slug) {
  return POR_SLUG.get(slug)?.nombre ?? "Otra forma de pago";
}

// La columna es un arreglo de texto, es decir, lo que sea que haya en la base.
// Se limpia en un solo lugar para que ni la ficha ni el panel tengan que
// preguntarse si lo que traen son formas de pago de verdad.
//
// El orden es el del catálogo y no el de guardado: así la ficha de dos
// restaurantes que aceptan lo mismo se lee igual en los dos.
export function formasDePagoDe(valor) {
  if (!Array.isArray(valor)) return [];
  const marcadas = new Set(valor.map((v) => String(v ?? "").trim()));
  return FORMAS_DE_PAGO.filter((f) => marcadas.has(f.slug)).map((f) => f.slug);
}

export function detallesDePago(slugs) {
  return formasDePagoDe(slugs).map((slug) => POR_SLUG.get(slug));
}
