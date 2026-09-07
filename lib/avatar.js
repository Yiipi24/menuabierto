import { cache } from "react";
import { supabaseSession } from "./supabase";

export const BUCKET_AVATARES = "avatares";

/**
 * La URL de la foto de la cuenta, o null si no ha puesto ninguna.
 *
 * Va con `cache` de React porque en el panel la piden dos veces en la misma
 * página —la cabecera y el cuerpo—, y sin esto serían dos viajes a la base
 * para traer exactamente lo mismo.
 */
export const fotoDeCuenta = cache(async function fotoDeCuenta(usuarioId) {
  if (!usuarioId) return null;

  const supabase = await supabaseSession();
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", usuarioId)
    .maybeSingle();

  // Que falle no puede dejar sin menú a la página entera: se dibuja el icono
  // de siempre y ya.
  if (error || !data?.avatar_path) return null;

  return supabase.storage.from(BUCKET_AVATARES).getPublicUrl(data.avatar_path).data
    .publicUrl;
});
