import { urlDelSitio } from "./sitio";
import { fotoCompartir } from "./fotos";

// Cómo se ve un enlace del sitio cuando alguien lo pega en WhatsApp. Aquí casi
// nadie comparte una ficha copiando el nombre: manda la dirección, y del otro
// lado se ve un recuadro. Sin `og:image` ese recuadro es una línea de texto
// gris; con la fachada del restaurante dentro es una invitación a comer.
//
// Va en un solo lugar porque son cuatro páginas —la portada, la ficha, la
// carta completa y la carta suelta— y cada una escribiendo sus diez etiquetas
// a mano es cuatro maneras distintas de olvidarse de una.

const SIN_ALT = "Menú Abierto";

/**
 * Las imágenes de una página, en el orden en que se ofrecen: las suyas
 * primero y, si no tiene ninguna, la del sitio.
 *
 * Solo se anuncian las dos primeras. WhatsApp y compañía se quedan con la
 * primera que pueden bajar, y una lista larga es una lista que el rastreador
 * recorre entera antes de dibujar el recuadro.
 */
export function imagenesDeCompartir(fotos = [], alt = SIN_ALT) {
  const suyas = (fotos ?? [])
    .filter((f) => f?.url)
    .slice(0, 2)
    .map((f) => ({ url: f.url, alt: f.alt || alt }));
  if (suyas.length) return suyas;

  const propia = fotoCompartir();
  return propia ? [{ url: urlDelSitio(propia), alt: SIN_ALT }] : [];
}

/**
 * Las etiquetas de Open Graph y de Twitter de una página, armadas a partir de
 * su título y su descripción —los que ya tenía— más su imagen y su dirección.
 *
 * El título que se comparte no lleva el "| Menú Abierto" del final: en el
 * recuadro el sitio ya sale abajo, en su propio renglón, y repetirlo solo
 * gasta el ancho que necesita el nombre del restaurante.
 */
export function metaCompartir({ titulo, tituloCorto, descripcion, ruta, imagenes = [] }) {
  const url = ruta ? urlDelSitio(ruta) : undefined;
  const nombre = tituloCorto || titulo;

  return {
    title: titulo,
    description: descripcion,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title: nombre,
      description: descripcion,
      url,
      siteName: "Menú Abierto",
      locale: "es_MX",
      // Siempre "website". Open Graph tiene un tipo `restaurant.restaurant`,
      // pero Next solo escribe los que conoce y truena con cualquier otro; y
      // ninguna de las redes por las que se comparte una ficha dibuja distinto
      // el recuadro por el tipo. Quien sí entiende que esto es un restaurante
      // es el buscador, y eso ya se lo dicen los datos estructurados.
      type: "website",
      images: imagenes,
    },
    twitter: {
      card: imagenes.length ? "summary_large_image" : "summary",
      title: nombre,
      description: descripcion,
      images: imagenes,
    },
  };
}
