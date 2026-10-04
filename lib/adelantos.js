// Sincronizar un pago por adelantado: lo que la pasarela dice de él, escrito
// en la base. Lo recorren el webhook y la vuelta del checkout.
//
// Igual que con las suscripciones, el aviso es un timbre: aquí se le pide el
// pago a la API y se escribe lo que ella dice. Registrarlo y aplicarlo pasa en
// una sola función de la base (`registrar_pago_por_adelantado`), que es la que
// garantiza que un pago aprobado sume sus meses una vez aunque Mercado Pago
// avise tres.

import { DEVUELTOS, estadoDePagoConocido, leerReferenciaDeAdelanto } from "./cobro";
import { obtenerPago } from "./mercadopago";
import { supabaseServicio } from "./supabase";
import { invalidarFicha } from "./cache";

// `restauranteEsperado`, si viene, es la ficha que quien llama ya comprobó que
// es del dueño: un pago de otra ficha no se escribe. La vuelta del checkout lo
// usa porque el id del pago lo puede escribir cualquiera en la URL.
export async function sincronizarPago(providerId, { restauranteEsperado = null } = {}) {
  const remoto = await obtenerPago(providerId);

  // Los cargos de las suscripciones también llegan como `payment`; esos los
  // lleva la suscripción, y su referencia no es la de un adelanto.
  const referencia = leerReferenciaDeAdelanto(remoto?.external_reference);
  if (!referencia) return null;
  if (restauranteEsperado && referencia.restauranteId !== restauranteEsperado) return null;

  const status = String(remoto?.status ?? "");
  if (!estadoDePagoConocido(status)) {
    console.warn("cobro: pago con un estado desconocido", providerId, status);
    return null;
  }

  const monto = Math.round(Number(remoto?.transaction_amount ?? 0) * 100);
  if (!(monto > 0)) {
    console.warn("cobro: pago sin monto", providerId);
    return null;
  }

  const supabase = supabaseServicio();
  const { data: ficha } = await supabase
    .from("restaurants")
    .select("id, slug")
    .eq("id", referencia.restauranteId)
    .maybeSingle();
  if (!ficha) {
    console.warn("cobro: el pago apunta a una ficha que no existe", providerId);
    return null;
  }

  const { data, error } = await supabase
    .rpc("registrar_pago_por_adelantado", {
      p_provider_id: String(remoto.id ?? providerId),
      p_restaurant: ficha.id,
      p_plan: referencia.plan,
      p_months: referencia.meses,
      p_status: status,
      p_method: remoto?.payment_type_id ? String(remoto.payment_type_id).slice(0, 40) : null,
      p_amount_cents: monto,
      p_currency: remoto?.currency_id ?? "MXN",
      p_expires_at: remoto?.date_of_expiration ?? null,
      p_approved_at: remoto?.date_approved ?? null,
    })
    .single();
  if (error) throw error;

  if (data?.aplicado) invalidarFicha(ficha.slug);
  // Una devolución no le quita sola los meses a la ficha: alguien tiene que
  // decidir si se le quitan, y lo tiene que ver en el log.
  if (DEVUELTOS.includes(data?.status) && data?.premium_until) {
    console.warn("cobro: pago devuelto con meses ya aplicados; revisar a mano", providerId, ficha.slug);
  }
  return { ficha, referencia, resultado: data };
}

/**
 * La red de seguridad del webhook. El aviso de que alguien pagó su ficha de
 * OXXO es el único que llega, y si se pierde —una caída nuestra, un reintento
 * que ya no pasa la firma—, el dinero entró y el plan no subió. Quien pagó y no
 * ve su plan abre la página de planes: ahí se le vuelven a pedir a la pasarela
 * sus pagos sin confirmar. Con la sesión del dueño, la RLS deja solo los suyos;
 * casi siempre no hay ninguno y esto es una consulta vacía.
 */
//
// Cada pago se vuelve a pedir a lo más cada diez minutos —registrarlo toca su
// `updated_at`—, y solo los del último mes: una ficha de OXXO abandonada la
// cancela la pasarela, y aquí se entera la primera vez que la pide.
const REVISAR_CADA_MS = 10 * 60 * 1000;
const REVISAR_HASTA_MS = 30 * 24 * 60 * 60 * 1000;

export async function confirmarPendientes(supabase, ahora = new Date()) {
  const { data, error } = await supabase
    .from("payments")
    .select("provider_id")
    .in("status", ["pending", "in_process"])
    .lt("updated_at", new Date(ahora.getTime() - REVISAR_CADA_MS).toISOString())
    .gt("created_at", new Date(ahora.getTime() - REVISAR_HASTA_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  await Promise.all(
    (data ?? []).map((p) =>
      sincronizarPago(p.provider_id).catch((e) =>
        console.error("cobro: no se pudo confirmar un pago pendiente", p.provider_id, e?.message),
      ),
    ),
  );
}

/**
 * Los pagos que importan hoy de unas fichas: los que todavía se pueden pagar
 * y los aplicados que siguen corriendo. Lo demás es historia y no cambia lo
 * que el panel ofrece. Con la sesión del dueño, la RLS ya deja solo los suyos.
 */
export async function pagosVigentes(supabase, restauranteIds, ahora = new Date()) {
  if (!restauranteIds?.length) return [];
  const { data, error } = await supabase
    .from("payments")
    .select("restaurant_id, plan, months, status, method, expires_at, period_end, applied_at, created_at")
    .in("restaurant_id", restauranteIds)
    .or(`status.in.(pending,in_process),period_end.gt."${ahora.toISOString()}"`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
