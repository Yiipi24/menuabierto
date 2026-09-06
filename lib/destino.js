import { supabaseSession } from "./supabase";

// A donde llevamos a quien acaba de entrar y no pedia una pagina concreta.
//
// Antes iba siempre al panel, y el panel es la casa de los restaurantes: un
// comensal que entraba a guardar favoritos aterrizaba en "Tus restaurantes,
// todavia no tienes ninguno", que le pide dar de alta un negocio que no tiene.
//
// Preguntamos por los restaurantes antes que por la intencion declarada al
// registrarse porque la intencion envejece: quien entro como comensal y luego
// reclamo su restaurante sigue marcado como comensal, y ese si quiere el panel.
export async function destinoTrasEntrar(user) {
  if (!user) return "/";

  const supabase = await supabaseSession();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1);

  if (error) console.error("destino tras entrar", error.message);
  if (data?.length) return "/panel";

  // Sin ninguna ficha, el panel solo le sirve a quien vino a publicar la suya.
  return user.user_metadata?.signup_intent === "restaurante" ? "/panel" : "/";
}
