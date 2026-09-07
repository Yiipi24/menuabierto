import { currentUser, supabaseServer, supabaseSession } from "./supabase";

// Lo que toda lista de restaurantes necesita después de la búsqueda: la foto
// de cada tarjeta y el corazón de quien entró. Vivía dentro de la portada, y
// las páginas de zona enseñan las mismas tarjetas: dos copias de esto son dos
// maneras distintas de pedir veinte veces lo que se pide una.

export const BUCKET_FOTOS = "restaurantes";

/**
 * La primera foto de cada resultado, en una sola consulta y no una por
 * tarjeta: con veinte restaurantes serían veinte viajes a la base.
 *
 * Sin fotos las tarjetas se dibujan con el degradado de su categoría, así que
 * un fallo aquí no rompe la lista.
 */
export async function conFotos(resultados) {
  if (!resultados?.length) return resultados ?? [];

  try {
    const supabase = supabaseServer();
    const { data: fotos } = await supabase
      .from("restaurant_media")
      .select("restaurant_id, storage_path, position")
      .in(
        "restaurant_id",
        resultados.map((r) => r.id),
      )
      .order("position");

    const primera = new Map();
    for (const f of fotos ?? []) {
      if (!primera.has(f.restaurant_id)) primera.set(f.restaurant_id, f.storage_path);
    }

    return resultados.map((r) => {
      const ruta = primera.get(r.id);
      return {
        ...r,
        foto: ruta ? supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl : null,
      };
    });
  } catch {
    return resultados;
  }
}

/**
 * Cuáles de estos restaurantes tiene guardados quien está mirando.
 *
 * Va por el cliente con sesión y no por el público: los favoritos son de quien
 * entró. Sin sesión no se pregunta nada, porque la RLS devolvería una lista
 * vacía de todos modos.
 */
export async function guardadosDe(resultados) {
  if (!resultados?.length) return new Set();

  const usuario = await currentUser().catch(() => null);
  if (!usuario) return new Set();

  try {
    const conSesion = await supabaseSession();
    const { data } = await conSesion
      .from("favorites")
      .select("restaurant_id")
      .in(
        "restaurant_id",
        resultados.map((r) => r.id),
      );
    return new Set((data ?? []).map((f) => f.restaurant_id));
  } catch {
    // Un fallo aquí solo significa corazones vacíos, no una lista rota.
    return new Set();
  }
}
