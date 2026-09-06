import { supabaseSession } from "./supabase";

// Quien se registro para publicar su menu. Es una senal de onboarding y no un
// permiso: lo que deja administrar una ficha es owner_id, nunca esto.
export function vinoAPublicar(user) {
  return user?.user_metadata?.signup_intent === "restaurante";
}

// Si esta persona tiene panel: administra al menos una ficha, o entro a dar de
// alta la suya y todavia no la crea. El comensal no tiene nada que administrar
// y el panel no le habla: le ofrece planes, reclamar fichas y dar de alta un
// negocio que no tiene.
export async function esRestaurantero(user) {
  if (!user) return false;

  const supabase = await supabaseSession();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);

  if (error) console.error("esRestaurantero", error.message);
  if (data?.length) return true;

  return vinoAPublicar(user);
}

// A donde llevamos a quien acaba de entrar y no pedia una pagina concreta.
// Antes iba siempre al panel, que es la casa de los restaurantes, y un
// comensal aterrizaba en "Tus restaurantes, todavia no tienes ninguno".
//
// Se mira si tiene fichas antes que la intencion declarada al registrarse
// porque la intencion envejece: quien entro como comensal y luego reclamo su
// restaurante sigue marcado como comensal, y ese si quiere el panel.
export async function destinoTrasEntrar(user) {
  if (!user) return "/";
  return (await esRestaurantero(user)) ? "/panel" : "/";
}
