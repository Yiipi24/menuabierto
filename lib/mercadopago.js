// Las llamadas a Mercado Pago. Solo del lado del servidor: el token da acceso
// a todo el dinero de la cuenta, así que no sale de las variables de entorno.
//
// Con la API de suscripciones (`preapproval`) no hay que tocar tarjetas: se
// crea la suscripción con precio y periodicidad, la pasarela devuelve un
// enlace (`init_point`) donde el dueño paga, y desde entonces avisa por webhook
// cada vez que la suscripción cambia. Aquí no se guarda nada de la tarjeta.

import { MONEDA, referenciaExterna } from "./cobro";
import { urlDelSitio } from "./sitio";

const API = "https://api.mercadopago.com";

export function cobroConfigurado() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

async function llamar(ruta, { method = "GET", body } = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MP_ACCESS_TOKEN.");

  const respuesta = await fetch(`${API}${ruta}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // La misma petición dos veces no debe crear dos suscripciones.
      ...(method === "POST" ? { "X-Idempotency-Key": crypto.randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    const detalle = datos?.message ?? datos?.error ?? texto.slice(0, 200);
    const error = new Error(`Mercado Pago ${respuesta.status}: ${detalle}`);
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}

/**
 * Crea la suscripción y devuelve `{ id, init_point, status }`.
 *
 * El `back_url` es a donde vuelve el dueño después de pagar; la pasarela le
 * agrega `preapproval_id`. Ahí se sincroniza el plan sin esperar al webhook,
 * para que al volver ya vea sus diez menús.
 */
export async function crearSuscripcion({ restauranteId, plan, precioCentavos, correo, razon }) {
  return llamar("/preapproval", {
    method: "POST",
    body: {
      reason: razon,
      external_reference: referenciaExterna(restauranteId, plan),
      payer_email: correo,
      back_url: urlDelSitio("/panel/planes/volver"),
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: precioCentavos / 100,
        currency_id: MONEDA,
      },
      status: "pending",
    },
  });
}

export async function obtenerSuscripcion(id) {
  return llamar(`/preapproval/${encodeURIComponent(id)}`);
}

export async function cancelarSuscripcion(id) {
  return llamar(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { status: "cancelled" },
  });
}

// Un aviso de cobro (`subscription_authorized_payment`) trae el id del cargo,
// no de la suscripción. Se pide el cargo para saber de cuál es.
export async function suscripcionDeCobro(idCobro) {
  const cobro = await llamar(`/authorized_payments/${encodeURIComponent(idCobro)}`);
  return cobro?.preapproval_id ?? null;
}
