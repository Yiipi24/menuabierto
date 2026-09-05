// Cómo se paga la cuenta: de las tres cosas que más se preguntan por teléfono,
// junto con el horario y la dirección. El catálogo vive en la tabla
// `payment_methods` y no aquí, para que agregar una forma —vales, CoDi,
// transferencia por app— sea un INSERT y no una migración más un despliegue.
//
// Por eso estas funciones reciben el catálogo en vez de importarlo: quien las
// llama ya lo trajo de la base. El orden es el de la tabla, y es el mismo en
// el panel y en la ficha.

// Las filas llegan como las devuelve PostgREST. Se traducen una vez, aquí,
// para que ni el formulario ni la ficha tengan que hablar en inglés.
export function catalogoDePagos(filas) {
  if (!Array.isArray(filas)) return [];
  return filas
    .filter((f) => f?.slug)
    .map((f) => ({
      slug: f.slug,
      nombre: f.name ?? "Forma de pago",
      pista: f.hint ?? "",
      icono: f.icon || f.slug,
    }));
}

// La columna es un arreglo de texto, es decir, lo que sea que haya en la base.
// Se limpia una vez, y en el orden del catálogo, para que la ficha de dos
// restaurantes que aceptan lo mismo se lea igual. Una clave que ya no esté en
// el catálogo desaparece sola en vez de salir en blanco.
export function formasDePagoDe(catalogo, valor) {
  if (!Array.isArray(valor)) return [];
  const marcadas = new Set(valor.map((v) => String(v ?? "").trim()));
  return catalogo.filter((f) => marcadas.has(f.slug)).map((f) => f.slug);
}

export function detallesDePago(catalogo, slugs) {
  const porSlug = new Map(catalogo.map((f) => [f.slug, f]));
  return formasDePagoDe(catalogo, slugs).map((slug) => porSlug.get(slug));
}
