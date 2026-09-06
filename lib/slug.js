// La dirección de una ficha es su nombre pegado: "JC Smoke House" vive en
// menuabierto.com/jcsmokehouse. Sin guiones, sin sufijo aleatorio y sin el
// /r/ que antes iba delante: la URL es lo que el dueño imprime en el vinil, la
// dicta por teléfono y la pega en Instagram, y ahí un "jc-smoke-house-j5e24"
// no se puede ni leer en voz alta.
//
// Cuando dos restaurantes se llaman igual, el segundo agrega su colonia como
// segundo tramo: /tacoselgordo/centro. Es lo que la gente usa para
// distinguirlos de todos modos.

// Todo lo que no sea letra o número desaparece, incluidos los espacios. Los
// acentos se pasan a su letra base antes, para que "Tacos Doña Ñora" no quede
// convertida en "tacosdoora".
export function aSegmento(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 60);
}

// Las rutas fijas del sitio. Un restaurante llamado "Panel" no puede quedarse
// con /panel, y "menu" está tomado porque es el segundo tramo de la carta.
// La lista se compara contra el primer tramo del slug (y "menu" también contra
// el segundo, que es donde iría una colonia).
export const RESERVADAS = new Set([
  "api",
  "auth",
  "entrar",
  "explorar",
  "favicon",
  "icon",
  "menu",
  "panel",
  "public",
  "q",
  "r",
  "reclamar",
  "recuperar",
  "registro",
  "robots",
  "sitemap",
  "waitlist",
  "_next",
]);

export function segmentoReservado(segmento) {
  return RESERVADAS.has(segmento);
}

// Un slug es un tramo ("jcsmokehouse") o dos ("tacoselgordo/centro"). Se guarda
// así, con la barra dentro, porque la unicidad de la dirección completa es lo
// que la base tiene que garantizar y ya lo hace con el índice único de `slug`.
export function partesDeSlug(slug) {
  return String(slug ?? "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function slugValido(slug) {
  const partes = partesDeSlug(slug);
  if (partes.length < 1 || partes.length > 2) return false;
  if (!partes.every((p) => /^[a-z0-9]{1,60}$/.test(p))) return false;
  if (segmentoReservado(partes[0])) return false;
  // "menu" de colonia chocaría con /restaurante/menu, que es la carta.
  if (partes.length === 2 && partes[1] === "menu") return false;
  return true;
}

// Las dos rutas públicas de un restaurante. Cada tramo se codifica por
// separado: encodeURIComponent sobre el slug entero convertiría la barra en
// %2F y la ruta dejaría de existir.
export function rutaFicha(slug) {
  const partes = partesDeSlug(slug).map(encodeURIComponent);
  return `/${partes.join("/")}`;
}

export function rutaMenu(slug) {
  return `${rutaFicha(slug)}/menu`;
}

/**
 * Arma el slug de un restaurante nuevo. `tomado` responde si una dirección ya
 * existe; se le pregunta en vez de recibir la lista entera porque la única
 * fuente fiable es la base.
 *
 * Orden: el nombre pelado, el nombre con la colonia, y solo si eso tampoco
 * alcanza, un número al final. El sufijo numerado es el último recurso y no la
 * regla, que era justo el problema del sufijo aleatorio de antes.
 */
export async function slugDisponible(nombre, colonia, tomado) {
  const base = aSegmento(nombre) || "restaurante";
  const raiz = segmentoReservado(base) ? `${base}restaurante` : base;

  if (!(await tomado(raiz))) return raiz;

  const zona = aSegmento(colonia);
  if (zona && zona !== "menu") {
    const conColonia = `${raiz}/${zona}`;
    if (!(await tomado(conColonia))) return conColonia;
  }

  // Dos veces el mismo nombre en la misma colonia. Se numera el tramo que
  // corresponda para no inventar una colonia que no existe.
  const plantilla = zona && zona !== "menu" ? (n) => `${raiz}/${zona}${n}` : (n) => `${raiz}${n}`;
  for (let n = 2; n < 1000; n += 1) {
    const intento = plantilla(n);
    if (!(await tomado(intento))) return intento;
  }

  // Inalcanzable en la práctica; mejor un slug feo que una ficha sin dirección.
  return `${raiz}${Date.now().toString(36)}`;
}

// La carta de un solo menú: /jcsmokehouse/menu/<id>. Es a donde lleva cada
// fila de la ficha, y una dirección que el dueño puede compartir suelta —la
// de bebidas, la del día— sin arrastrar las demás detrás.
//
// El id va al final y no como `?menu=`: una dirección que se comparte no
// debería depender de que la query sobreviva a un acortador o a un copiar y
// pegar.
export function rutaMenuCarta(slug, menuId) {
  return `${rutaMenu(slug)}/${encodeURIComponent(menuId)}`;
}

// Los ids de menú son uuid. Se comprueba antes de ir a la base para que
// /jcsmokehouse/menu/loquesea sea un 404 barato y no una consulta.
export function menuIdValido(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id ?? ""));
}

// La dirección del QR impreso: /q/<codigo>. No lleva el slug a propósito. El
// código es un dato de la ficha que la base no deja cambiar, así que el vinil
// pegado en la mesa sigue llevando al mismo restaurante aunque el nombre, la
// colonia o la dirección de la ficha cambien mañana. De paso es corto, y un
// QR corto tiene menos módulos: se lee de más lejos y aguanta mejor una
// impresión sucia.
export function rutaQr(codigo) {
  return `/q/${encodeURIComponent(codigo)}`;
}

// El código lo reparte la base con un alfabeto sin las letras que se
// confunden (o/0, i/l/1). Se comprueba la forma antes de ir a preguntar: así
// /q/loquesea es un 404 barato y no una consulta.
export function qrCodigoValido(codigo) {
  return /^[a-z0-9]{4,16}$/.test(String(codigo ?? ""));
}
