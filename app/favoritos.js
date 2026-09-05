"use server";

import { supabaseSession } from "../lib/supabase";

// Guardar y quitar de guardados. Las dos operaciones caben en una sola acción
// porque el corazón es un interruptor: quien lo pulsa quiere lo contrario de
// lo que ve.
//
// No se revalida ninguna ruta a propósito. El botón ya se pintó en su estado
// nuevo antes de llamar aquí, y volver a pedir la búsqueda entera —con su RPC
// y sus fotos— para cambiar un corazón sería pagar la página completa por un
// clic. La lista se rehace sola en la siguiente visita.
export async function alternarFavorito(restauranteId, guardar) {
  const supabase = await supabaseSession();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { ok: false, motivo: "sesion" };

  const consulta = guardar
    ? supabase
        .from("favorites")
        .upsert(
          { profile_id: data.user.id, restaurant_id: restauranteId },
          { onConflict: "profile_id,restaurant_id" },
        )
    : supabase
        .from("favorites")
        .delete()
        .eq("profile_id", data.user.id)
        .eq("restaurant_id", restauranteId);

  const { error: fallo } = await consulta;
  return fallo ? { ok: false, motivo: "error" } : { ok: true };
}
