// Sincronizar una suscripción: lo que la pasarela dice de ella, escrito en la
// base. Es el único camino por el que cambia el plan de una ficha, y lo
// recorren tres cosas: el webhook, la vuelta del checkout y la cancelación.
//
// La verdad no viene en el webhook sino en la API: el aviso solo dice "mira la
// suscripción tal", y aquí se pide su estado completo. Así un aviso repetido,
// viejo o inventado no puede escribir nada que la pasarela no confirme, y
// procesar el mismo aviso dos veces deja la base igual que una.

import { estadoDesdeSuscripcion, leerReferencia } from "./cobro";
import { obtenerSuscripcion } from "./mercadopago";
import { supabaseServicio } from "./supabase";
import { invalidarFicha } from "./cache";

export async function sincronizarSuscripcion(providerId) {
  const remota = await obtenerSuscripcion(providerId);
  const referencia = leerReferencia(remota?.external_reference);
  if (!referencia) {
    console.warn("cobro: suscripción sin referencia propia", providerId);
    return null;
  }

  const supabase = supabaseServicio();
  const { data: ficha } = await supabase
    .from("restaurants")
    .select("id, slug, plan, premium_until")
    .eq("id", referencia.restauranteId)
    .maybeSingle();
  if (!ficha) {
    console.warn("cobro: la suscripción apunta a una ficha que no existe", providerId);
    return null;
  }

  // La fila propia. Si hay una de otra suscripción para la misma ficha (un
  // cambio de plan), la nueva la reemplaza: la vieja ya se canceló en la
  // pasarela antes de crear esta.
  const { data: propia } = await supabase
    .from("subscriptions")
    .select("id, provider_id, status, synced_at")
    .eq("restaurant_id", ficha.id)
    .maybeSingle();

  if (propia && propia.provider_id !== providerId) {
    const remotaEsMasNueva = remota?.status !== "cancelled";
    // Un aviso tardío de la suscripción vieja no debe pisar la nueva.
    if (!remotaEsMasNueva) return null;
  }

  const estado = estadoDesdeSuscripcion(
    { status: remota.status, plan: referencia.plan, next_payment_date: remota.next_payment_date },
    ficha,
  );
  if (!estado) {
    console.warn("cobro: estado desconocido", providerId, remota?.status);
    return null;
  }

  const monto = Math.round(Number(remota?.auto_recurring?.transaction_amount ?? 0) * 100);
  const fila = {
    restaurant_id: ficha.id,
    provider: "mercadopago",
    provider_id: providerId,
    plan: referencia.plan,
    status: estado.status,
    amount_cents: monto > 0 ? monto : 1,
    currency: remota?.auto_recurring?.currency_id ?? "MXN",
    payer_email: remota?.payer_email ?? null,
    next_payment_at: remota?.next_payment_date ?? null,
    cancelled_at: estado.status === "cancelled" ? new Date().toISOString() : null,
    synced_at: new Date().toISOString(),
  };

  const { error: errorFila } = await supabase
    .from("subscriptions")
    .upsert(fila, { onConflict: "restaurant_id" });
  if (errorFila) throw errorFila;

  // `pending` no toca la ficha: todavía no pagó nada.
  if (estado.plan !== null) {
    const { error } = await supabase
      .from("restaurants")
      .update({
        plan: estado.plan,
        premium_until: estado.premium_until ? estado.premium_until.toISOString() : null,
      })
      .eq("id", ficha.id);
    if (error) throw error;
    invalidarFicha(ficha.slug);
  }

  return { ficha, estado, fila };
}
