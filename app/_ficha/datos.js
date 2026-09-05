import { supabaseServer, supabaseSession } from "../../lib/supabase";
import { plantillaValida } from "../../lib/plantillas";
import { destacadosDe } from "../destacados";
import { conEsquema, nombreDeRed } from "../../lib/redes";
import { catalogoDePagos, detallesDePago } from "../../lib/pagos";
import { catalogoDeServicios, detallesDeServicio } from "../../lib/servicios";
import { conteoDe } from "../../lib/insignias";
import { agruparPlatillos } from "../../lib/menus";

// La carga vive aquí y no en la página porque ahora son dos: la ficha y la
// carta completa. Las dos necesitan lo mismo y ninguna debería tener su propia
// versión de las consultas.

export const BUCKET_FOTOS = "restaurantes";
export const BUCKET_MENUS = "menus";
export const PRECIO = ["", "$", "$$", "$$$", "$$$$"];
export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function hora(t) {
  return typeof t === "string" ? t.slice(0, 5) : t;
}

// El día que la ficha marca como "hoy" es el del local, no el del servidor:
// en Vercel son las seis de la mañana del martes mientras en Monterrey todavía
// es lunes por la noche.
export function diaLocal(zona) {
  const dias = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  try {
    const corto = new Intl.DateTimeFormat("en-US", {
      timeZone: zona || "America/Mexico_City",
      weekday: "short",
    })
      .format(new Date())
      .toLowerCase();
    const i = dias.indexOf(corto);
    return i === -1 ? new Date().getDay() : i;
  } catch {
    return new Date().getDay();
  }
}

export function direccionDe(r) {
  return [r.street, r.neighborhood, r.city, r.state, r.postal_code].filter(Boolean).join(", ");
}

// Muchos dueños pegan la dirección otra vez en la descripción, así que la
// ficha la enseñaba dos y tres veces. Se comparan sin acentos, sin comas y sin
// mayúsculas porque nunca la escriben igual dos veces.
function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Es la dirección repetida si comparten la calle y el número: lo demás
// (colonia, "Cdad.", el estado abreviado) cambia de una a otra.
export function repiteDireccion(texto, r) {
  const a = normalizar(texto);
  if (!a) return false;
  const calle = normalizar(r?.street);
  if (!calle) return false;
  const dir = normalizar(direccionDe(r));
  return a === dir || (a.includes(calle) && a.length < dir.length + 40);
}

// Cada menú se arma completo aquí y no en el render: la página pinta lo que
// recibe y no tiene que cruzar tres listas mientras genera HTML. El agrupado
// en sí vive en lib/menus porque la vista previa del panel usa el mismo.
function armarMenus(supabase, menus, secciones, platillos) {
  return menus
    .map((m) => {
      const mios = platillos.filter((p) => p.menu_id === m.id);
      const grupos = agruparPlatillos(
        secciones.filter((s) => s.menu_id === m.id),
        mios,
        `${m.id}-sueltos`,
      );

      return {
        id: m.id,
        name: m.name,
        kind: m.kind,
        template: plantillaValida(m.template),
        // El estilo se pasa tal cual: quien lo pinta lo sanea con
        // `estiloDeMenu`, que sabe cuáles son los ajustes de esa plantilla.
        style: m.style,
        fileMime: m.file_mime,
        fileUrl: m.file_path
          ? supabase.storage.from(BUCKET_MENUS).getPublicUrl(m.file_path).data.publicUrl
          : null,
        grupos,
      };
    })
    // Un menú digital sin platillos, o uno de archivo sin archivo, está a
    // medio hacer. Enseñarlo vacío es peor que no enseñarlo.
    .filter((m) => (m.kind === "archivo" ? Boolean(m.fileUrl) : m.grupos.length > 0));
}

export async function cargar(slug) {
  const supabase = supabaseServer();

  // La RLS solo deja ver fichas publicadas, así que un borrador ajeno da 404
  // igual que un slug inventado: la página no revela que existe.
  const { data: r } = await supabase
    .from("restaurants")
    .select(
      "id, owner_id, slug, name, summary, description, price_level, phone, website, street, neighborhood, city, state, postal_code, timezone, rating_avg, rating_count, highlights, social_links, payment_methods, amenities, parking_cost, parking_kind, service_mode, closed_days",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!r) return null;

  const [
    cocinas,
    horarios,
    fotos,
    menus,
    secciones,
    platillos,
    abierto,
    resenas,
    catalogoServicios,
    catalogoPagos,
  ] = await Promise.all([
    supabase.from("restaurant_cuisines").select("cuisines (name)").eq("restaurant_id", r.id),
    supabase
      .from("restaurant_hours")
      .select("weekday, opens, closes")
      .eq("restaurant_id", r.id)
      .order("weekday"),
    supabase
      .from("restaurant_media")
      .select("storage_path, alt, category")
      .eq("restaurant_id", r.id)
      .order("position"),
    // Un restaurante puede tener varias cartas: la de comida, la de bebidas,
    // la del día. Las ocultas son las que el dueño está preparando.
    supabase
      .from("menus")
      .select("id, name, kind, template, style, file_path, file_mime, position")
      .eq("restaurant_id", r.id)
      .eq("is_visible", true)
      .order("position")
      .order("created_at"),
    supabase
      .from("menu_sections")
      .select("id, menu_id, name, position")
      .eq("restaurant_id", r.id)
      .order("position")
      .order("created_at"),
    supabase
      .from("menu_items")
      .select("id, menu_id, section_id, name, description, price_cents, currency, icon, is_available, position")
      .eq("restaurant_id", r.id)
      .order("position")
      .order("created_at"),
    supabase.rpc("restaurant_abierto", { rid: r.id }),
    // Por RPC y no por join: profiles es privado, y esta funcion devuelve el
    // nombre de quien firma sin abrir el resto del perfil.
    supabase.rpc("resenas_restaurante", { rid: r.id }),
    // El catálogo de servicios vive en la base para que agregar uno no exija
    // desplegar. Va en el mismo Promise.all que todo lo demás: es una consulta
    // diminuta y en paralelo no cuesta nada.
    supabase.from("amenities").select("slug, name, hint, icon").order("position"),
    supabase.from("payment_methods").select("slug, name, hint, icon").order("position"),
  ]);

  const servicios = catalogoDeServicios(catalogoServicios.data ?? []);
  const pagos = catalogoDePagos(catalogoPagos.data ?? []);

  return {
    r,
    // Los destacados y las redes se limpian aquí, una vez: vienen de jsonb y
    // la página no debería preguntarse si cada pieza trae lo que dice traer.
    destacados: destacadosDe(r.highlights),
    redes: (Array.isArray(r.social_links) ? r.social_links : [])
      .map((red) => ({
        slug: red?.network ?? "otra",
        nombre: nombreDeRed(red?.network),
        url: conEsquema(red?.url),
      }))
      .filter((red) => red.url),
    // Las formas de pago se resuelven aquí, con su nombre y su pista: la
    // ficha pinta lo que recibe y no traduce claves mientras genera HTML.
    pagos: detallesDePago(pagos, r.payment_methods),
    servicios: detallesDeServicio(
      servicios,
      r.amenities,
      r.parking_cost,
      r.service_mode,
      r.parking_kind,
    ),
    cerrados: (r.closed_days ?? []).map(Number),
    cocinas: (cocinas.data ?? []).map((c) => c.cuisines?.name).filter(Boolean),
    horarios: horarios.data ?? [],
    // La fachada encabeza la ficha aunque se haya subido al final: es la foto
    // que se reconoce al llegar al local.
    fotos: (fotos.data ?? [])
      .map((f) => ({
        ...f,
        url: supabase.storage.from(BUCKET_FOTOS).getPublicUrl(f.storage_path).data.publicUrl,
      }))
      .sort((a, b) => (a.category === "fachada" ? -1 : 0) - (b.category === "fachada" ? -1 : 0)),
    menus: armarMenus(
      supabase,
      menus.data ?? [],
      secciones.data ?? [],
      platillos.data ?? [],
    ),
    abierto: abierto.data === true,
    resenas: resenas.data ?? [],
  };
}

// Cuántas reseñas lleva escritas quien está firmado. Va aparte de `cargar`
// porque `cargar` corre con el cliente anónimo —la ficha es pública— y este
// número exige sesión: un perfil solo se lee a sí mismo. Con él, la ficha le
// puede decir a la persona cuánto le falta para su siguiente insignia.
export async function resenasEscritas(userId) {
  if (!userId) return 0;
  const supabase = await supabaseSession();
  const { data } = await supabase
    .from("profiles")
    .select("reviews_count")
    .eq("id", userId)
    .maybeSingle();
  return conteoDe(data?.reviews_count);
}
