"use server";

import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { PLANES } from "../../../lib/planes";
import { planDePagaValido, precioDe } from "../../../lib/cobro";
import { cancelarSuscripcion, cobroConfigurado, crearSuscripcion } from "../../../lib/mercadopago";
import { sincronizarSuscripcion } from "../../../lib/suscripciones";
import { uuidValido } from "../../../lib/slug";

// El dueño de la ficha, o nada. La RLS ya impide leer lo ajeno; comprobarlo
// aquí es para poder contestar "ese restaurante no es tuyo" en vez de crear
// una suscripción para nadie.
async function fichaDelDueno(id) {
  if (!uuidValido(id)) return { supabase: null, auth: null, ficha: null };
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: ficha } = await supabase
    .from("restaurants")
    .select("id, name, slug, plan, premium_until")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  return { supabase, auth, ficha };
}

async function suscripcionDe(supabase, restauranteId) {
  const { data } = await supabase
    .from("subscriptions")
    .select("id, provider_id, plan, status")
    .eq("restaurant_id", restauranteId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Contratar Plus o Premium para una ficha. Crea la suscripción en la pasarela
 * y manda al dueño a pagar; el plan sube cuando la pasarela confirma, no aquí.
 * Si ya tenía otra suscripción viva, se cancela antes: una ficha paga un plan.
 */
export async function contratarPlan(formData) {
  const id = String(formData.get("restaurante") ?? "");
  const plan = String(formData.get("plan") ?? "");

  if (!planDePagaValido(plan)) redirect("/panel/planes?error=plan");
  if (!cobroConfigurado()) redirect("/panel/planes?error=cobro");

  const { supabase, auth, ficha } = await fichaDelDueno(id);
  if (!ficha) redirect("/panel/planes?error=ficha");

  const actual = await suscripcionDe(supabase, ficha.id);
  if (actual && actual.plan === plan && ["authorized", "pending"].includes(actual.status)) {
    redirect("/panel/planes?aviso=ya");
  }

  let creada;
  try {
    if (actual && ["authorized", "paused", "pending"].includes(actual.status)) {
      await cancelarSuscripcion(actual.provider_id);
    }
    creada = await crearSuscripcion({
      restauranteId: ficha.id,
      plan,
      precioCentavos: precioDe(plan),
      correo: auth.user.email,
      razon: `Menú Abierto · ${PLANES.find((p) => p.slug === plan)?.nombre ?? plan} · ${ficha.name}`,
    });
  } catch (error) {
    console.error("cobro: no se pudo crear la suscripción", error?.message);
    redirect("/panel/planes?error=pasarela");
  }

  // Se registra ya como pendiente: así la vuelta del checkout y el webhook
  // encuentran la fila aunque lleguen antes de que el dueño termine de pagar.
  try {
    await sincronizarSuscripcion(creada.id);
  } catch (error) {
    console.error("cobro: no se pudo registrar la suscripción pendiente", error?.message);
  }

  if (!creada?.init_point) redirect("/panel/planes?error=pasarela");
  redirect(creada.init_point);
}

/**
 * Cancelar. El plan no baja aquí: se queda hasta el fin del periodo pagado,
 * que es lo que la pasarela devuelve al sincronizar.
 */
export async function cancelarPlan(formData) {
  const id = String(formData.get("restaurante") ?? "");
  const { supabase, ficha } = await fichaDelDueno(id);
  if (!ficha) redirect("/panel/planes?error=ficha");

  const actual = await suscripcionDe(supabase, ficha.id);
  if (!actual || actual.status === "cancelled") redirect("/panel/planes");

  try {
    await cancelarSuscripcion(actual.provider_id);
    await sincronizarSuscripcion(actual.provider_id);
  } catch (error) {
    console.error("cobro: no se pudo cancelar", error?.message);
    redirect("/panel/planes?error=pasarela");
  }
  redirect("/panel/planes?aviso=cancelada");
}
