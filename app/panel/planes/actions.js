"use server";

import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { PLANES, planVigente } from "../../../lib/planes";
import {
  adelantoVigente,
  cobroAutomaticoActivo,
  leerOpcionDeAdelanto,
  mesesLegibles,
  pagoPorCobrar,
  planDePagaValido,
  precioDe,
  totalPorAdelantado,
} from "../../../lib/cobro";
import {
  cancelarSuscripcion,
  cobroConfigurado,
  crearPreferencia,
  crearSuscripcion,
} from "../../../lib/mercadopago";
import { sincronizarSuscripcion } from "../../../lib/suscripciones";
import { pagosVigentes } from "../../../lib/adelantos";
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

function nombreDe(plan) {
  return PLANES.find((p) => p.slug === plan)?.nombre ?? plan;
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

  // Con meses pagados por adelantado, o con una ficha de OXXO por pagar, el
  // cobro automático le cobraría dos veces el mismo mes. Se activa al vencer.
  let pagos;
  try {
    pagos = await pagosVigentes(supabase, [ficha.id]);
  } catch (error) {
    console.error("cobro: no se pudieron leer los pagos por adelantado", error?.message);
    redirect("/panel/planes?error=pasarela");
  }
  if (adelantoVigente(pagos)) redirect("/panel/planes?error=adelanto");
  if (pagos.some((p) => pagoPorCobrar(p))) redirect("/panel/planes?error=por-cobrar");

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
      razon: `Menú Abierto · ${nombreDe(plan)} · ${ficha.name}`,
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

/**
 * Pagar meses por adelantado: un solo pago por el total, que en Mercado Pago
 * se puede hacer en OXXO, por SPEI, con saldo o con tarjeta. Aquí solo se crea
 * el pago y se manda al dueño a hacerlo; los meses se suman cuando la
 * pasarela lo aprueba, que con OXXO puede ser días después.
 */
export async function pagarPorAdelantado(formData) {
  const id = String(formData.get("restaurante") ?? "");
  const opcion = leerOpcionDeAdelanto(formData.get("opcion"));

  if (!opcion) redirect("/panel/planes?error=plan");
  if (!cobroConfigurado()) redirect("/panel/planes?error=cobro");

  const { supabase, auth, ficha } = await fichaDelDueno(id);
  if (!ficha) redirect("/panel/planes?error=ficha");

  // Con el cobro automático andando, pagar además por adelantado sería pagar
  // dos veces. Una suscripción que se quedó en pending es un pago con tarjeta
  // que no se terminó: esa se cancela, porque quien vuelve aquí eligió pagar
  // de otra manera.
  const actual = await suscripcionDe(supabase, ficha.id);
  if (cobroAutomaticoActivo(actual)) redirect("/panel/planes?error=suscripcion");

  // Más meses del plan que ya tiene, o cualquiera si está en Básico. Cambiar
  // de plan con uno vigente perdería lo que queda del otro. Una ficha de OXXO
  // por pagar cuenta igual: si se paga después, sería un plan encima de otro.
  let pagos;
  try {
    pagos = await pagosVigentes(supabase, [ficha.id]);
  } catch (error) {
    console.error("cobro: no se pudieron leer los pagos por adelantado", error?.message);
    redirect("/panel/planes?error=pasarela");
  }
  const vigente = planVigente(ficha);
  if (vigente !== "basico" && vigente !== opcion.plan) redirect("/panel/planes?error=cambio");
  if (pagos.some((p) => pagoPorCobrar(p) && p.plan !== opcion.plan)) {
    redirect("/panel/planes?error=otro-por-cobrar");
  }

  const total = totalPorAdelantado(opcion.plan, opcion.meses);

  let preferencia;
  try {
    if (actual?.status === "pending") {
      await cancelarSuscripcion(actual.provider_id);
      await sincronizarSuscripcion(actual.provider_id);
    }
    preferencia = await crearPreferencia({
      restauranteId: ficha.id,
      plan: opcion.plan,
      meses: opcion.meses,
      totalCentavos: total,
      correo: auth.user.email,
      titulo: `Menú Abierto · ${nombreDe(opcion.plan)} · ${mesesLegibles(opcion.meses)} · ${ficha.name}`,
    });
  } catch (error) {
    console.error("cobro: no se pudo crear el pago por adelantado", error?.message);
    redirect("/panel/planes?error=pasarela");
  }

  if (!preferencia?.init_point) redirect("/panel/planes?error=pasarela");
  redirect(preferencia.init_point);
}
