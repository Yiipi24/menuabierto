import { supabaseServer, todasLasFilas } from "../lib/supabase";
import { rutaFicha, rutaMenu, rutaMenuCarta } from "../lib/slug";
import { sitioIndexable, urlDelSitio } from "../lib/sitio";
import { catalogoComida, rutaCocina, rutaZona } from "../lib/zonas";
import { ACTUALIZADO } from "../lib/legal";
import { menuPublicable, platillosDeFila } from "../lib/menus-publicos";

// El sitemap se arma con la base, no a mano: las fichas son casi todo el sitio
// y aparecen y se publican solas. Se recalcula cada hora en vez de en cada
// visita porque un rastreador pidiéndolo no debería costar un recorrido
// completo de la tabla, y una ficha nueva puede esperar ese rato.
export const revalidate = 3600;

// El recorrido por páginas vive en lib/supabase: lo comparten el sitemap y el
// catálogo de /comida. El tope de ahí está muy por debajo de las 50 000 URLs
// que admite un sitemap; cuando el directorio se acerque habrá que partirlo en
// un índice de varios archivos, y es mejor quedarse corto que servir uno
// inválido.

function fecha(...valores) {
  const tiempos = valores
    .map((v) => (v ? new Date(v).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  return tiempos.length ? new Date(Math.max(...tiempos)) : new Date();
}

export default async function sitemap() {
  const portada = {
    url: urlDelSitio("/"),
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  };

  // En una vista previa el robots.txt ya cierra el sitio entero; recorrer la
  // base para anunciar direcciones que nadie va a rastrear no aporta nada.
  if (!sitioIndexable()) return [portada];

  let restaurantes = [];
  let menus = [];
  try {
    const supabase = supabaseServer();

    // La RLS solo deja ver las fichas publicadas y los menús visibles de esas
    // fichas, así que un borrador no puede colarse aquí. El filtro por estado
    // va de todos modos: el sitemap no debería depender de una política para
    // no anunciar una ficha a medio hacer.
    //
    // El orden es por slug y no por fecha porque las páginas se piden con
    // `range`: con un orden que cambia entre una consulta y la siguiente, una
    // fila puede salir dos veces y otra no salir nunca.
    restaurantes = await todasLasFilas((desde, hasta) =>
      supabase
        .from("restaurants")
        .select("id, slug, updated_at")
        .eq("status", "publicado")
        .order("slug")
        .range(desde, hasta),
    );

    // Visible no basta: un menú de archivo sin archivo, o uno digital sin
    // platillos, la ficha no lo enseña y su URL responde "Menú no
    // encontrado". Anunciarlo es mandar al rastreador a una página vacía.
    const filas = await todasLasFilas((desde, hasta) =>
      supabase
        .from("menus")
        .select("id, restaurant_id, updated_at, kind, file_path, menu_items(count)")
        .eq("is_visible", true)
        .order("id")
        .range(desde, hasta),
    );
    menus = filas.filter((m) => menuPublicable({ ...m, platillos: platillosDeFila(m) }));
  } catch {
    // Sin base no hay directorio, pero el sitio sigue existiendo: mejor un
    // sitemap con la portada que un 500 que le enseña un error al rastreador.
    return [portada];
  }

  const porRestaurante = new Map();
  for (const m of menus) {
    const lista = porRestaurante.get(m.restaurant_id);
    if (lista) lista.push(m);
    else porRestaurante.set(m.restaurant_id, [m]);
  }

  // Las páginas de /comida son el otro contenido del sitio: una por tipo de
  // comida y una por cada cruce de comida y zona con restaurantes dentro. No
  // se anuncian todas las combinaciones posibles porque solo existen las que
  // tienen algo que enseñar; el catálogo ya viene con esa lista hecha.
  const catalogo = await catalogoComida();

  const urls = [
    portada,
    {
      url: urlDelSitio("/comida"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    // Quién vende qué y a cuánto: la búsqueda por precio de platillo.
    {
      url: urlDelSitio("/precios"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    // Las preguntas frecuentes: lo que un dueño busca antes de registrarse,
    // y a quién escribirle.
    {
      url: urlDelSitio("/ayuda"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // Lo que busca un dueño antes de registrarse: cuánto cuesta.
    {
      url: urlDelSitio("/planes"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // El aviso de privacidad y los términos: casi nunca cambian, pero un dueño
    // que busca "Menú Abierto términos" antes de pagar tiene que encontrarlos.
    ...["/privacidad", "/terminos"].map((ruta) => ({
      url: urlDelSitio(ruta),
      lastModified: new Date(`${ACTUALIZADO}T00:00:00Z`),
      changeFrequency: "yearly",
      priority: 0.3,
    })),
  ];

  for (const c of catalogo.cocinas) {
    urls.push({
      url: urlDelSitio(rutaCocina(c.slug)),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Debajo de las fichas y de las cartas: una página de zona vale por los
  // restaurantes que enseña, y son ellos los que hay que rastrear primero.
  for (const c of catalogo.combos) {
    urls.push({
      url: urlDelSitio(rutaZona(c.cocina, c.zona)),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  for (const r of restaurantes) {
    const suyos = porRestaurante.get(r.id) ?? [];

    urls.push({
      url: urlDelSitio(rutaFicha(r.slug)),
      lastModified: fecha(r.updated_at, ...suyos.map((m) => m.updated_at)),
      changeFrequency: "weekly",
      priority: 0.8,
    });

    // Sin menús visibles la carta es una página vacía: existe, pero no hay
    // nada que ofrecerle a un buscador.
    if (!suyos.length) continue;

    urls.push({
      url: urlDelSitio(rutaMenu(r.slug)),
      lastModified: fecha(r.updated_at, ...suyos.map((m) => m.updated_at)),
      changeFrequency: "weekly",
      priority: 0.6,
    });

    // Con una sola carta, /jcsmokehouse/menu y /jcsmokehouse/menu/<id> enseñan
    // exactamente lo mismo. Anunciar las dos es pedirle a un buscador que
    // elija entre dos copias; la suelta solo entra cuando de verdad es una
    // parte del conjunto.
    if (suyos.length < 2) continue;

    for (const m of suyos) {
      urls.push({
        url: urlDelSitio(rutaMenuCarta(r.slug, m.id)),
        lastModified: fecha(m.updated_at, r.updated_at),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return urls.slice(0, 50000);
}
