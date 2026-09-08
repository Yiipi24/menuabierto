import { SITIO, urlDelSitio } from "./sitio";
import { enlaceWhatsapp, mensajeDeContacto } from "./whatsapp";
import { rutaFicha, rutaMenu, rutaMenuCarta } from "./slug";

// Los datos estructurados de una ficha: lo mismo que la página ya enseña
// —nombre, dirección, horario, calificación, carta— pero escrito para que un
// buscador lo lea sin adivinarlo del HTML. Con esto una ficha puede salir en
// Google con sus estrellas, su rango de precio y su horario debajo del título,
// que es la diferencia entre un resultado y un resultado en el que se hace
// clic.
//
// Se arma aquí y no en el render por lo mismo que los menús: la página pinta
// lo que recibe. Y sobre todo, porque la regla que más importa —que el marcado
// diga exactamente lo que se ve en la página— es fácil de romper sin querer si
// cada plantilla escribe el suyo.

const DIAS_SCHEMA = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Las claves vacías se van: un `"telephone": null` no es un dato faltante para
// un validador, es un dato mal escrito. Se limpia al final y una sola vez, así
// los armadores de arriba pueden escribir el campo sin preguntarse si existe.
function limpio(objeto) {
  if (Array.isArray(objeto)) {
    const lista = objeto.map(limpio).filter((v) => v != null);
    return lista.length ? lista : null;
  }
  if (objeto && typeof objeto === "object") {
    const salida = {};
    for (const [clave, valor] of Object.entries(objeto)) {
      const limpiado = limpio(valor);
      if (limpiado != null) salida[clave] = limpiado;
    }
    // Un nodo que solo trae su @type no dice nada; mejor no escribirlo. El
    // @id sí cuenta: `{ "@id": "...#restaurante" }` es una referencia al nodo
    // de al lado, y es todo lo que tiene que decir.
    return Object.keys(salida).filter((c) => c !== "@type").length ? salida : null;
  }
  if (typeof objeto === "string") {
    const texto = objeto.trim();
    return texto ? texto : null;
  }
  if (typeof objeto === "number") return Number.isFinite(objeto) ? objeto : null;
  return objeto ?? null;
}

const PRECIO_SCHEMA = ["", "$", "$$", "$$$", "$$$$"];

// El país va escrito porque siempre es el mismo, pero solo cuando hay algo más
// que decir: una dirección que únicamente dice "MX" no ubica a nadie y deja al
// buscador con un campo lleno y un dato vacío.
function direccionSchema(r) {
  const partes = [r.street, r.city, r.state, r.postal_code].filter(Boolean);
  if (!partes.length) return null;
  return {
    "@type": "PostalAddress",
    streetAddress: r.street,
    addressLocality: r.city,
    addressRegion: r.state,
    postalCode: r.postal_code,
    addressCountry: "MX",
  };
}

// El horario sale de las mismas filas que pinta la ficha. Los días cerrados no
// se anuncian: schema.org admite decirlos, pero Google prefiere la ausencia, y
// un día sin filas ya es un día sin servicio.
function horarioSchema(horarios) {
  return (horarios ?? [])
    .filter((h) => h.opens && h.closes && DIAS_SCHEMA[h.weekday])
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DIAS_SCHEMA[h.weekday]}`,
      opens: String(h.opens).slice(0, 5),
      closes: String(h.closes).slice(0, 5),
    }));
}

// Solo se declara la calificación cuando hay reseñas detrás. Un
// `ratingValue: 0` con `reviewCount: 0` es marcado inválido y, peor, es
// presumir una nota que nadie puso.
function calificacionSchema(r) {
  const cuantas = Number(r.rating_count ?? 0);
  const promedio = Number(r.rating_avg ?? 0);
  if (!(cuantas > 0) || !(promedio > 0)) return null;
  return {
    "@type": "AggregateRating",
    ratingValue: promedio,
    reviewCount: cuantas,
    bestRating: 5,
    worstRating: 1,
  };
}

// Un puñado de reseñas, las mismas que ya se leen en la página. No van todas:
// el marcado acompaña a la ficha, no la duplica, y cien reseñas dentro de un
// <script> son cien reseñas que el visitante descarga sin verlas.
const TOPE_RESENAS = 5;

function resenasSchema(resenas) {
  return (resenas ?? [])
    .filter((v) => Number(v.rating) > 0)
    .slice(0, TOPE_RESENAS)
    .map((v) => ({
      "@type": "Review",
      author: { "@type": "Person", name: v.author_name },
      datePublished: v.created_at ? String(v.created_at).slice(0, 10) : null,
      reviewBody: v.body,
      reviewRating: {
        "@type": "Rating",
        ratingValue: Number(v.rating),
        bestRating: 5,
        worstRating: 1,
      },
    }));
}

function platilloSchema(p) {
  const centavos = p.price_cents;
  return {
    "@type": "MenuItem",
    name: p.name,
    description: p.description,
    offers:
      centavos == null
        ? null
        : {
            "@type": "Offer",
            price: (Number(centavos) / 100).toFixed(2),
            priceCurrency: p.currency || "MXN",
            availability:
              p.is_available === false
                ? "https://schema.org/SoldOut"
                : "https://schema.org/InStock",
          },
  };
}

/**
 * Una carta como `Menu`. `url` es la de esta página en concreto: la carta
 * completa y la suelta son direcciones distintas y cada una declara la suya,
 * porque si las dos dijeran la misma un buscador tendría dos menús con la
 * misma identidad.
 *
 * Las de archivo (un PDF, una foto) se quedan fuera: no hay platillos que
 * declarar y un `Menu` vacío no es un dato, es ruido.
 */
export function menuSchema(menu, url) {
  if (!menu || menu.kind === "archivo") return null;
  const secciones = (menu.grupos ?? []).map((g) => ({
    "@type": "MenuSection",
    name: g.name,
    hasMenuItem: (g.items ?? []).map(platilloSchema),
  }));
  if (!secciones.length) return null;

  return {
    "@type": "Menu",
    name: menu.name,
    description: menu.description,
    url,
    inLanguage: "es-MX",
    hasMenuSection: secciones,
  };
}

// Las migas de pan le dicen al buscador dónde cuelga la página, y son lo que
// convierte la línea verde del resultado en "Menú Abierto › JC Smoke House ›
// Menú" en vez de la URL cruda.
function migasSchema(pasos) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: pasos.map((paso, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: paso.nombre,
      item: paso.url,
    })),
  };
}

// "Se puede pedir aquí", dicho para un buscador. Es la misma acción que el
// botón de la ficha —el mismo chat, con el mismo mensaje— porque la regla de
// esta hoja es que el marcado no diga nada que la página no enseñe.
function pedidoSchema(pedidos, nombre, url) {
  if (!pedidos) return null;
  return {
    "@type": "OrderAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: enlaceWhatsapp(pedidos.telefono, mensajeDeContacto(nombre, url)),
      inLanguage: "es-MX",
      actionPlatform: [
        "https://schema.org/DesktopWebPlatform",
        "https://schema.org/MobileWebPlatform",
      ],
    },
  };
}

function restauranteSchema({ r, slug, cocinas, horarios, fotos, resenas, menus, redes, pagos, pedidos }) {
  const url = urlDelSitio(rutaFicha(slug));
  const hayCartas = (menus ?? []).length > 0;

  return {
    "@type": "Restaurant",
    // El @id es la identidad de este restaurante para un buscador: la misma en
    // la ficha y en la carta, para que las dos páginas hablen del mismo lugar
    // en vez de inventar uno cada una.
    "@id": `${url}#restaurante`,
    name: r.name,
    url,
    description: r.summary || r.description,
    telephone: r.phone,
    image: (fotos ?? []).slice(0, 6).map((f) => f.url),
    address: direccionSchema(r),
    servesCuisine: cocinas ?? [],
    priceRange: r.price_level ? PRECIO_SCHEMA[r.price_level] : null,
    paymentAccepted: (pagos ?? []).map((p) => p.name ?? p.nombre).filter(Boolean).join(", "),
    hasMenu: hayCartas ? urlDelSitio(rutaMenu(slug)) : null,
    aggregateRating: calificacionSchema(r),
    review: resenasSchema(resenas),
    openingHoursSpecification: horarioSchema(horarios),
    // El sitio web del dueño y sus redes son la otra mitad de su identidad:
    // con `sameAs` un buscador puede juntar la ficha con su Instagram en vez
    // de tratarlos como dos lugares parecidos.
    sameAs: [r.website, ...(redes ?? []).map((red) => red.url)].filter(Boolean),
    potentialAction: pedidoSchema(pedidos, r.name, url),
  };
}

/**
 * El bloque de la ficha: el restaurante y sus migas de pan, en un solo grafo.
 *
 * Van juntos y no en dos <script> porque son la misma página describiéndose:
 * un grafo se lee de una vez y deja los nodos enlazados por su @id.
 */
export function jsonLdFicha(datos, slug) {
  return limpio({
    "@context": "https://schema.org",
    "@graph": [
      restauranteSchema({ ...datos, slug }),
      migasSchema([
        { nombre: "Menú Abierto", url: SITIO },
        { nombre: datos.r.name, url: urlDelSitio(rutaFicha(slug)) },
      ]),
    ],
  });
}

/**
 * El bloque de una carta: el restaurante otra vez —con su mismo @id, para que
 * el menú cuelgue de alguien— y el menú que esta página enseña.
 *
 * Con `menuId` es una carta suelta y solo va esa. Sin él son todas las
 * visibles, que es lo que la página pinta.
 */
export function jsonLdCarta(datos, slug, menuId = null) {
  const { r, menus } = datos;
  const fichaUrl = urlDelSitio(rutaFicha(slug));
  const solo = menuId ? (menus ?? []).find((m) => m.id === menuId) ?? null : null;

  const cartas = solo
    ? [menuSchema(solo, urlDelSitio(rutaMenuCarta(slug, solo.id)))]
    : (menus ?? []).map((m) => menuSchema(m, urlDelSitio(rutaMenu(slug))));

  const migas = [
    { nombre: "Menú Abierto", url: SITIO },
    { nombre: r.name, url: fichaUrl },
    { nombre: "Menú", url: urlDelSitio(rutaMenu(slug)) },
  ];
  if (solo) migas.push({ nombre: solo.name, url: urlDelSitio(rutaMenuCarta(slug, solo.id)) });

  return limpio({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Restaurant",
        "@id": `${fichaUrl}#restaurante`,
        name: r.name,
        url: fichaUrl,
        address: direccionSchema(r),
      },
      ...cartas.filter(Boolean).map((carta) => ({
        ...carta,
        // El menú no flota: es de este restaurante, y así lo dice.
        inMenuOfRestaurant: { "@id": `${fichaUrl}#restaurante` },
      })),
      migasSchema(migas),
    ],
  });
}

/**
 * El bloque de una página de listado: /comida/tacos/coyoacan y sus hermanas.
 *
 * No repite los datos de cada restaurante —eso ya lo dice su ficha, y
 * duplicarlo aquí es pedirle a un buscador que decida cuál de los dos se cree—
 * sino que enumera a quiénes enseña, en el orden en que se ven, y a dónde
 * lleva cada uno. Con las migas, la línea del resultado deja de ser una URL y
 * pasa a leerse "Menú Abierto › Comida › Tacos › Coyoacán".
 */
export function jsonLdListado({ titulo, descripcion, ruta, migas, restaurantes = [] }) {
  const url = urlDelSitio(ruta);

  return limpio({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#pagina`,
        url,
        name: titulo,
        description: descripcion,
        inLanguage: "es-MX",
        isPartOf: { "@type": "WebSite", "@id": `${SITIO}#sitio`, name: "Menú Abierto", url: SITIO },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: restaurantes.length,
          itemListElement: restaurantes.map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: r.name,
            url: urlDelSitio(rutaFicha(r.slug)),
          })),
        },
      },
      migasSchema(migas),
    ],
  });
}
