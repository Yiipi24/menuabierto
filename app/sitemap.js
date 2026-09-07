import { supabaseServer } from "../lib/supabase";
import { rutaFicha, rutaMenu, rutaMenuCarta } from "../lib/slug";
import { sitioIndexable, urlDelSitio } from "../lib/sitio";

// El sitemap se arma con la base, no a mano: las fichas son casi todo el sitio
// y aparecen y se publican solas. Se recalcula cada hora en vez de en cada
// visita porque un rastreador pidiéndolo no debería costar un recorrido
// completo de la tabla, y una ficha nueva puede esperar ese rato.
export const revalidate = 3600;

// Supabase devuelve 1000 filas como máximo por consulta, así que se pide por
// páginas. El tope está muy por debajo de las 50 000 URLs que admite un
// sitemap: cuando el directorio se acerque habrá que partirlo en un índice de
// varios archivos, y es mejor quedarse corto que servir uno inválido.
const PAGINA = 1000;
const TOPE = 40000;

async function todasLasFilas(consulta) {
  const filas = [];
  for (let desde = 0; desde < TOPE; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw error;
    if (!data?.length) break;
    filas.push(...data);
    if (data.length < PAGINA) break;
  }
  return filas;
}

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

    menus = await todasLasFilas((desde, hasta) =>
      supabase
        .from("menus")
        .select("id, restaurant_id, updated_at")
        .eq("is_visible", true)
        .order("id")
        .range(desde, hasta),
    );
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

  const urls = [portada];

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
