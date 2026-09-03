import { supabaseServer } from "../../../lib/supabase";
import { plantillaValida } from "../../../lib/plantillas";
import { destacadosDe } from "../../destacados";
import { conEsquema, nombreDeRed } from "../../../lib/redes";

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

export function direccionDe(r) {
  return [r.street, r.neighborhood, r.city, r.state, r.postal_code].filter(Boolean).join(", ");
}

// Cada menú se arma completo aquí y no en el render: la página pinta lo que
// recibe y no tiene que cruzar tres listas mientras genera HTML.
//
// Un platillo sin sección no desaparece: se va a un grupo propio al final. Y
// una sección vacía tampoco se pinta, porque un encabezado sin nada debajo
// solo hace creer que algo falló.
function armarMenus(supabase, menus, secciones, platillos) {
  return menus
    .map((m) => {
      const mios = platillos.filter((p) => p.menu_id === m.id);
      const grupos = [
        ...secciones
          .filter((s) => s.menu_id === m.id)
          .map((s) => ({
            id: s.id,
            name: s.name,
            items: mios.filter((p) => p.section_id === s.id),
          })),
        {
          id: `${m.id}-sueltos`,
          name: "Otros platillos",
          items: mios.filter((p) => !p.section_id),
        },
      ].filter((g) => g.items.length);

      return {
        id: m.id,
        name: m.name,
        kind: m.kind,
        template: plantillaValida(m.template),
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
      "id, owner_id, slug, name, summary, description, price_level, phone, website, street, neighborhood, city, state, postal_code, rating_avg, rating_count, highlights, social_links, closed_days",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!r) return null;

  const [cocinas, horarios, fotos, menus, secciones, platillos, abierto, resenas] = await Promise.all([
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
      .select("id, name, kind, template, file_path, file_mime, position")
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
      .select("id, menu_id, section_id, name, description, price_cents, currency, is_available, position")
      .eq("restaurant_id", r.id)
      .order("position")
      .order("created_at"),
    supabase.rpc("restaurant_abierto", { rid: r.id }),
    // Por RPC y no por join: profiles es privado, y esta funcion devuelve el
    // nombre de quien firma sin abrir el resto del perfil.
    supabase.rpc("resenas_restaurante", { rid: r.id }),
  ]);

  return {
    r,
    // Los destacados y las redes se limpian aquí, una vez: vienen de jsonb y
    // la página no debería preguntarse si cada pieza trae lo que dice traer.
    destacados: destacadosDe(r.highlights),
    redes: (Array.isArray(r.social_links) ? r.social_links : [])
      .map((red) => ({ nombre: nombreDeRed(red?.network), url: conEsquema(red?.url) }))
      .filter((red) => red.url),
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
