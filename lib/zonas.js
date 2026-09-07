import { unstable_cache } from "next/cache";
import { TAG_RUTAS, VIGENCIA_RUTAS } from "./cache";
import { supabaseServer, todasLasFilas } from "./supabase";

/**
 * Las páginas de zona: /comida/tacos/coyoacan.
 *
 * Quien busca dónde comer no escribe "restaurantes" en Google: escribe "tacos
 * en Coyoacán". Esa búsqueda existía en el sitio desde el primer día
 * —`/?cocina=tacos&lugar=Coyoacán`— pero vivía en la query, y una dirección
 * con query no es una página para un buscador: no se anuncia en el sitemap, no
 * la enlaza nadie y las combinaciones se leen como copias de la portada. Así
 * que la misma búsqueda tiene ahora su dirección propia, con su título, su
 * texto y sus enlaces a las zonas vecinas.
 *
 * Estas páginas no se inventan: cada una existe porque hay al menos un
 * restaurante publicado de esa cocina en esa zona. Un directorio que genera
 * todas las combinaciones posibles de veintiocho cocinas por cada colonia del
 * país publica miles de páginas vacías, y eso tiene nombre —doorway pages— y
 * castigo. El catálogo de abajo es justo la lista de las que sí tienen algo
 * que enseñar.
 */

// El tramo de una zona se escribe con guiones: "Gral. Escobedo" vive en
// /comida/bbq/gral-escobedo. Es al revés que el slug de una ficha, que va
// pegado porque el dueño lo dicta por teléfono; una zona no la dicta nadie, la
// lee un buscador, y ahí los guiones separan palabras.
export function aTramo(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
}

// Se comprueba la forma antes de ir a la base: /comida/TACOS o
// /comida/tacos/../../etc es un 404 barato y no una consulta.
export function tramoValido(tramo) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(tramo ?? "")) && String(tramo).length <= 80;
}

/**
 * Cuántos restaurantes tiene que haber en un cruce de cocina y zona para que
 * la página exista.
 *
 * Hoy es uno: en un directorio que arranca, una página con un solo
 * restaurante sigue siendo la respuesta exacta a "birria en Gral. Escobedo", y
 * quien la busca prefiere encontrar uno que ninguno. Cuando haya densidad de
 * verdad, este número sube y sobran páginas flacas: es el único sitio donde se
 * cambia, y de ahí salen a la vez las que se generan y las que se anuncian en
 * el sitemap.
 */
export const MINIMO_POR_PAGINA = 1;

export function rutaCocina(cocina) {
  return `/comida/${encodeURIComponent(cocina)}`;
}

export function rutaZona(cocina, zona) {
  return `${rutaCocina(cocina)}/${encodeURIComponent(zona)}`;
}

// La búsqueda de siempre, con esta página ya puesta: es a donde lleva "afinar"
// desde una zona, para seguir con el mapa, el precio y los servicios.
export function rutaBusqueda(cocina, zonaNombre) {
  const params = new URLSearchParams();
  if (cocina) params.set("cocina", cocina);
  if (zonaNombre) params.set("lugar", zonaNombre);
  const cadena = params.toString();
  return cadena ? `/?${cadena}` : "/";
}

// Una zona es el municipio o la colonia de una ficha publicada. El estado no
// entra: "Nuevo León" no es una zona a la que alguien vaya a comer, y las
// páginas que saldrían de ahí dirían lo mismo que las de sus municipios.
function zonasDeFicha(r) {
  const zonas = [];
  for (const [nombre, tipo] of [
    [r.city, "ciudad"],
    [r.neighborhood, "colonia"],
  ]) {
    const limpio = String(nombre ?? "").trim();
    if (!limpio) continue;
    const slug = aTramo(limpio);
    // Un nombre que se queda sin letras ni números —"—", "s/n"— no puede ser
    // una dirección.
    if (!slug || zonas.some((z) => z.slug === slug)) continue;
    zonas.push({ slug, nombre: limpio, tipo, estado: String(r.state ?? "").trim() || null });
  }
  return zonas;
}

/**
 * Todo lo que hace falta para las páginas de /comida, en un solo recorrido:
 * qué cocinas tienen restaurante, en qué zonas, y cuántos hay en cada cruce.
 *
 * Se arma en JavaScript y no con una función de la base a propósito: son dos
 * consultas de un directorio que hoy cabe en una pantalla, y el resultado se
 * guarda un día entero. Cuando el catálogo crezca lo suficiente para que
 * recorrerlo entero moleste, este es el sitio donde se cambia por un
 * `group by`, y nadie más se entera.
 */
async function cargarCatalogo() {
  const supabase = supabaseServer();

  // La RLS solo deja ver las fichas publicadas; el filtro por estado va de
  // todos modos, porque una página de zona no debería depender de una política
  // para no contar un borrador.
  const [fichas, cruces] = await Promise.all([
    todasLasFilas((desde, hasta) =>
      supabase
        .from("restaurants")
        .select("id, city, state, neighborhood")
        .eq("status", "publicado")
        .order("id")
        .range(desde, hasta),
    ),
    todasLasFilas((desde, hasta) =>
      supabase
        .from("restaurant_cuisines")
        .select("restaurant_id, cuisines (slug, name)")
        .order("restaurant_id")
        .order("cuisine_id")
        .range(desde, hasta),
    ),
  ]);

  const porFicha = new Map(fichas.map((r) => [r.id, r]));

  const cocinas = new Map();
  const zonas = new Map();
  const combos = new Map();

  for (const cruce of cruces) {
    const c = cruce.cuisines;
    const r = porFicha.get(cruce.restaurant_id);
    // Un cruce de una ficha que no está publicada no cuenta: la RLS ya la dejó
    // fuera de la consulta de arriba, así que aquí llega sin ficha.
    if (!c?.slug || !r) continue;

    const cocina = cocinas.get(c.slug) ?? { slug: c.slug, nombre: c.name, total: 0 };
    cocina.total += 1;
    cocinas.set(c.slug, cocina);

    for (const z of zonasDeFicha(r)) {
      // Dos nombres distintos pueden caer en el mismo tramo ("Gral. Escobedo"
      // y "Gral Escobedo"). Gana el que más fichas tenga: es el que la gente
      // escribe, y el otro se cuenta dentro.
      const puesta = zonas.get(z.slug);
      if (!puesta) zonas.set(z.slug, { ...z, total: 1 });
      else {
        puesta.total += 1;
        if (puesta.tipo === "colonia" && z.tipo === "ciudad") {
          puesta.nombre = z.nombre;
          puesta.tipo = "ciudad";
          puesta.estado = z.estado;
        }
      }

      const llave = `${c.slug}|${z.slug}`;
      const combo = combos.get(llave) ?? {
        cocina: c.slug,
        cocinaNombre: c.name,
        zona: z.slug,
        zonaNombre: z.nombre,
        estado: z.estado,
        total: 0,
      };
      combo.total += 1;
      combos.set(llave, combo);
    }
  }

  const porTotal = (a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es");

  // El mínimo se aplica aquí y en ningún otro sitio: lo que no está en el
  // catálogo no tiene página ni entra en el sitemap, y las dos cosas no pueden
  // discrepar.
  return {
    // Una cocina se mide por todos sus restaurantes y un cruce por los suyos:
    // "tacos" con tres, uno en cada zona, tiene página propia aunque ninguna de
    // las tres zonas llegue al mínimo por su cuenta.
    cocinas: [...cocinas.values()].filter((c) => c.total >= MINIMO_POR_PAGINA).sort(porTotal),
    zonas: [...zonas.values()].sort(porTotal),
    // Las combinaciones se ordenan igual para que el sitemap y las listas de
    // "otras zonas" enseñen primero las que más tienen.
    combos: [...combos.values()]
      .filter((c) => c.total >= MINIMO_POR_PAGINA)
      .sort((a, b) => b.total - a.total || a.zonaNombre.localeCompare(b.zonaNombre, "es")),
  };
}

// Cambia cuando una ficha se publica, se oculta o se muda, y eso ya tira la
// etiqueta `rutas`: es la misma que usan el sitemap y las traducciones de
// dirección, y por la misma razón.
const catalogoGuardado = unstable_cache(cargarCatalogo, ["catalogo-comida"], {
  revalidate: VIGENCIA_RUTAS,
  tags: [TAG_RUTAS],
});

export const CATALOGO_VACIO = { cocinas: [], zonas: [], combos: [] };

/**
 * El catálogo, o uno vacío si la base no contesta.
 *
 * Sin base no hay páginas de zona, pero tampoco un 500 en la cara de quien
 * llega: las que existen devuelven 404 hasta que la base vuelva, que es lo
 * mismo que dice hoy una zona sin restaurantes.
 */
export async function catalogoComida() {
  try {
    return (await catalogoGuardado()) ?? CATALOGO_VACIO;
  } catch {
    return CATALOGO_VACIO;
  }
}

export function cocinaDe(catalogo, slug) {
  return catalogo.cocinas.find((c) => c.slug === slug) ?? null;
}

export function comboDe(catalogo, cocina, zona) {
  return catalogo.combos.find((c) => c.cocina === cocina && c.zona === zona) ?? null;
}

/** Las zonas donde esta cocina tiene restaurante, de más a menos. */
export function zonasDeCocina(catalogo, cocina) {
  return catalogo.combos.filter((c) => c.cocina === cocina);
}

/** Las cocinas que hay en esta zona, de más a menos. */
export function cocinasDeZona(catalogo, zona) {
  return catalogo.combos.filter((c) => c.zona === zona);
}

/** Si una ficha de la búsqueda es de esta zona. */
export function esDeLaZona(r, zona) {
  return aTramo(r?.city) === zona || aTramo(r?.neighborhood) === zona;
}
