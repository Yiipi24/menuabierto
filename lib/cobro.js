// La lógica del cobro que no habla con nadie: cuánto cuesta cada plan, qué
// plan y qué vigencia se desprenden de lo que dice la pasarela, y cómo se
// comprueba la firma de un webhook. Vive aparte de `lib/mercadopago.js`, que
// es el que hace las llamadas, para poder probarla sin red y sin llaves.
//
// La pasarela es Mercado Pago, y cobra de dos maneras. La suscripción se cobra
// sola cada mes, pero solo a una tarjeta (de crédito o de débito): en México
// Mercado Pago no cobra en automático ni a OXXO ni a SPEI. Para quien no tiene
// tarjeta está el pago por adelantado: de uno a doce meses en un solo pago,
// que sí acepta OXXO, SPEI y saldo de Mercado Pago, que es como paga medio
// país. Stripe queda como alternativa si algún día se prioriza la tarjeta
// internacional; por eso las tablas guardan `provider` y nada de aquí presume
// que sólo existirá una.

import { createHmac, timingSafeEqual } from "crypto";

// Los precios en centavos, como todo el dinero del repo. Se pueden mover con
// variables de entorno sin desplegar —`PRECIO_PLUS_MXN=249`— porque el precio
// de lanzamiento se decide fuera del código; lo que no se puede es cobrar
// cero: un plan sin precio no se ofrece.
function precioDesdeEntorno(variable, porDefecto) {
  const n = Number(process.env[variable]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : porDefecto;
}

export const MONEDA = "MXN";

export const PRECIOS_CENTAVOS = {
  plus: precioDesdeEntorno("PRECIO_PLUS_MXN", 19900),
  premium: precioDesdeEntorno("PRECIO_PREMIUM_MXN", 39900),
};

// Los planes que se cobran. Básico no está: es gratis, y "contratar básico"
// es cancelar lo demás.
export const PLANES_DE_PAGA = Object.keys(PRECIOS_CENTAVOS);

export function planDePagaValido(slug) {
  return PLANES_DE_PAGA.includes(slug);
}

export function precioDe(slug) {
  return PRECIOS_CENTAVOS[slug] ?? null;
}

// Cuando un cobro falla, Mercado Pago pausa la suscripción y la reintenta
// varios días. Mientras tanto el dueño no debería perder sus menús por una
// tarjeta vencida: la ficha sigue en su plan esta semana, y sólo después baja.
export const DIAS_DE_GRACIA = 7;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function fecha(valor) {
  if (!valor) return null;
  const t = new Date(valor).getTime();
  return Number.isFinite(t) ? new Date(t) : null;
}

/**
 * Lo que la ficha debe tener según el estado de la suscripción en la pasarela.
 *
 * Devuelve `{ plan, premium_until, status }` listos para escribir en
 * `restaurants` y en `subscriptions`. Es la única regla del cambio de plan y
 * por eso está sola aquí:
 *
 * - `authorized`: al corriente. El plan sube y la vigencia es el siguiente
 *   cobro más la gracia, para que un reintento de la pasarela no baje la
 *   ficha antes de tiempo.
 * - `paused`: un cobro falló. No se toca la vigencia que ya estaba: la gracia
 *   que se dio con el último cobro bueno es la que corre, y la base degrada
 *   sola al vencer.
 * - `cancelled`: se queda lo pagado. Vence cuando iba a venir el cobro que ya
 *   no vendrá, sin gracia, y si eso ya pasó, vence ahora.
 * - `pending`: todavía no pagó la primera. Nada cambia.
 *
 * Con un estado que no se conoce no se hace nada: mejor una ficha que se queda
 * como estaba que una que sube por un valor nuevo de la pasarela.
 */
export function estadoDesdeSuscripcion(suscripcion, ficha = {}, ahora = new Date()) {
  const status = String(suscripcion?.status ?? "");
  const plan = String(suscripcion?.plan ?? "");
  const proximo = fecha(suscripcion?.next_payment_date);
  const actualHasta = fecha(ficha?.premium_until);

  if (!planDePagaValido(plan)) return null;

  if (status === "authorized") {
    const base = proximo && proximo.getTime() > ahora.getTime() ? proximo : new Date(ahora.getTime() + 30 * MS_POR_DIA);
    return {
      status,
      plan,
      premium_until: new Date(base.getTime() + DIAS_DE_GRACIA * MS_POR_DIA),
    };
  }

  if (status === "paused") {
    // Sin una vigencia previa no hay nada que conservar: la pausa antes del
    // primer cobro es una suscripción que nunca arrancó.
    if (!actualHasta) return { status, plan: "basico", premium_until: null };
    return { status, plan, premium_until: actualHasta };
  }

  if (status === "cancelled") {
    // Sin una vigencia previa no se pagó nada: cancelar una suscripción que
    // se quedó en pending no regala el plan hasta su primer cobro.
    if (!actualHasta) return { status, plan: "basico", premium_until: null };
    const hasta = proximo && proximo.getTime() > ahora.getTime() ? proximo : ahora;
    // Lo pagado se respeta hasta la fecha, pero nunca más allá de lo que la
    // ficha ya tenía: cancelar no regala días.
    const tope = actualHasta && actualHasta.getTime() < hasta.getTime() ? actualHasta : hasta;
    if (tope.getTime() <= ahora.getTime()) return { status, plan: "basico", premium_until: null };
    return { status, plan, premium_until: tope };
  }

  if (status === "pending") return { status, plan: null, premium_until: undefined };

  return null;
}

/**
 * La referencia con la que se crea la suscripción en la pasarela y con la que
 * vuelve en el webhook: el id del restaurante y el plan, juntos, para que al
 * leerla no haga falta adivinar qué se compró.
 */
export function referenciaExterna(restauranteId, plan) {
  return `${restauranteId}:${plan}`;
}

export function leerReferencia(referencia) {
  const [restauranteId, plan] = String(referencia ?? "").split(":");
  if (!restauranteId || !planDePagaValido(plan)) return null;
  return { restauranteId, plan };
}

/**
 * La firma de un webhook de Mercado Pago.
 *
 * Llega en `x-signature` como `ts=<segundos>,v1=<hmac>`, y el HMAC-SHA256 se
 * calcula, con el secreto del webhook, sobre esta plantilla exacta:
 *
 *     id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * Las partes que no vienen se omiten con su etiqueta. Un id alfanumérico va en
 * minúsculas. Se compara en tiempo constante, y una firma con más de cinco
 * minutos de antigüedad se rechaza aunque sea válida: un webhook viejo
 * repetido no debe poder mover un plan.
 */
export const TOLERANCIA_FIRMA_SEGUNDOS = 300;

export function manifiestoDeFirma({ dataId, requestId, ts }) {
  const partes = [];
  if (dataId) partes.push(`id:${String(dataId).toLowerCase()}`);
  if (requestId) partes.push(`request-id:${requestId}`);
  if (ts) partes.push(`ts:${ts}`);
  return partes.length ? `${partes.join(";")};` : "";
}

export function partesDeFirma(cabecera) {
  const partes = {};
  for (const trozo of String(cabecera ?? "").split(",")) {
    const i = trozo.indexOf("=");
    if (i < 0) continue;
    partes[trozo.slice(0, i).trim()] = trozo.slice(i + 1).trim();
  }
  return { ts: partes.ts ?? null, v1: partes.v1 ?? null };
}

export function firmar(manifiesto, secreto) {
  return createHmac("sha256", secreto).update(manifiesto).digest("hex");
}

export function firmaValida({ cabecera, requestId, dataId, secreto, ahora = Date.now() }) {
  if (!secreto) return false;
  const { ts, v1 } = partesDeFirma(cabecera);
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  const segundos = Number(ts);
  if (!Number.isFinite(segundos)) return false;
  // Mercado Pago manda milisegundos en algunos webhooks y segundos en otros.
  const emitido = segundos > 1e12 ? segundos : segundos * 1000;
  if (Math.abs(ahora - emitido) > TOLERANCIA_FIRMA_SEGUNDOS * 1000) return false;

  const esperada = firmar(manifiestoDeFirma({ dataId, requestId, ts }), secreto);
  const a = Buffer.from(esperada, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Los avisos que mandan a `data.id` de una suscripción. Los de `payment` van
// por `idDePagoEnAviso`: el estado de un cargo de la suscripción lo dice la
// suscripción, y el de un pago por adelantado, el pago.
export function idDeSuscripcionEnAviso(aviso) {
  const tipo = String(aviso?.type ?? aviso?.topic ?? "");
  const id = aviso?.data?.id ?? aviso?.id ?? null;
  if (!id) return null;
  if (tipo === "subscription_preapproval") return { clase: "suscripcion", id: String(id) };
  if (tipo === "subscription_authorized_payment") return { clase: "cobro", id: String(id) };
  return null;
}

// Cómo se lee el estado en el panel. Los nombres son los de la pasarela; lo
// que ve el dueño está en su idioma y en sus términos.
export const ESTADOS = {
  pending: { nombre: "Pago pendiente", pista: "Aún no se ha confirmado el primer pago." },
  authorized: { nombre: "Al corriente", pista: "La suscripción se renueva cada mes." },
  paused: {
    nombre: "Pago rechazado",
    pista: "El último cobro no pasó. Se reintenta unos días antes de volver a Básico.",
  },
  cancelled: { nombre: "Cancelada", pista: "El plan sigue hasta el fin del periodo pagado." },
};

export function estadoLegible(status) {
  return ESTADOS[status] ?? { nombre: status ?? "—", pista: "" };
}

// ---------------------------------------------------------------------------
// Pago por adelantado
//
// Un pago suelto que compra meses del plan. Es la puerta de quien no tiene
// tarjeta: Mercado Pago lo deja pagar en OXXO, por SPEI o con saldo, y el
// plan corre desde que el pago se aprueba. No se renueva solo; al vencer, la
// ficha vuelve a Básico como cualquier plan vencido.

// Cuántos meses se pueden pagar de una vez. Doce es el tope: más que un año
// por adelantado es un precio que puede cambiar a medio camino.
export const MESES_POR_ADELANTADO = [1, 3, 6, 12];

export function mesesValidos(meses) {
  const texto = String(meses ?? "");
  return /^[0-9]{1,2}$/.test(texto) && MESES_POR_ADELANTADO.includes(Number(texto));
}

// El total en centavos: el precio del mes por los meses. Sin descuento por
// pagar más meses; si algún día lo hay, se decide aquí y la página lo enseña
// sola.
export function totalPorAdelantado(plan, meses) {
  const mensual = precioDe(plan);
  return mensual && mesesValidos(meses) ? mensual * Number(meses) : null;
}

// Lo que el panel manda en el <select>: "plus:3". Una sola opción con plan y
// meses juntos deja enseñar el total de cada combinación sin JavaScript.
export function opcionDeAdelanto(plan, meses) {
  return `${plan}:${meses}`;
}

export function leerOpcionDeAdelanto(valor) {
  const [plan, meses, ...resto] = String(valor ?? "").split(":");
  if (resto.length || !planDePagaValido(plan) || !mesesValidos(meses)) return null;
  return { plan, meses: Number(meses) };
}

// La referencia del pago en la pasarela. Lleva un prefijo propio porque los
// cargos de las suscripciones también llegan como `payment`, y algunos traen
// la referencia de su suscripción ("<ficha>:<plan>"): sin el prefijo, un
// cargo mensual se leería como meses comprados.
const PREFIJO_ADELANTO = "adelanto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function referenciaDeAdelanto(restauranteId, plan, meses) {
  return `${PREFIJO_ADELANTO}:${restauranteId}:${plan}:${meses}`;
}

export function leerReferenciaDeAdelanto(referencia) {
  const [prefijo, restauranteId, plan, meses, ...resto] = String(referencia ?? "").split(":");
  if (prefijo !== PREFIJO_ADELANTO || resto.length) return null;
  if (!UUID.test(restauranteId ?? "") || !planDePagaValido(plan) || !mesesValidos(meses)) return null;
  return { restauranteId, plan, meses: Number(meses) };
}

// Los avisos de un pago: `type: "payment"` y el id en `data.id`. Un id de
// pago de Mercado Pago son solo dígitos.
export function idDePagoEnAviso(aviso) {
  const tipo = String(aviso?.type ?? aviso?.topic ?? "");
  if (tipo !== "payment") return null;
  const id = String(aviso?.data?.id ?? aviso?.id ?? "");
  return /^[0-9]{1,30}$/.test(id) ? id : null;
}

// Los estados de un pago en la pasarela, los mismos que acepta la tabla
// `payments`. Uno que no está aquí no se registra: mejor un aviso en el log
// que una fila que la base rechaza a medias.
export const ESTADOS_DE_PAGO = [
  "pending",
  "in_process",
  "authorized",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
  "in_mediation",
];

export function estadoDePagoConocido(status) {
  return ESTADOS_DE_PAGO.includes(String(status ?? ""));
}

// Si una ficha de OXXO no trae fecha de vencimiento, se da por vencida a los
// tres días, que es lo que dura en Mercado Pago.
export const DIAS_PARA_PAGAR = 3;

/**
 * Un pago que todavía se puede pagar: una ficha de OXXO o una referencia de
 * SPEI que el dueño generó y no ha pagado. Mientras exista, el panel no ofrece
 * el cobro automático: pagar las dos cosas sería cobrarle dos veces el mismo
 * mes.
 */
export function pagoPorCobrar(pago, ahora = new Date()) {
  if (!["pending", "in_process"].includes(pago?.status)) return false;
  const creado = fecha(pago?.created_at);
  const vence =
    fecha(pago?.expires_at) ?? (creado ? new Date(creado.getTime() + DIAS_PARA_PAGAR * MS_POR_DIA) : null);
  return Boolean(vence && vence.getTime() > ahora.getTime());
}

// Un pago devuelto o con contracargo ya no cubre nada. Los meses que había
// sumado no se le quitan solos a la ficha (eso se atiende a mano), pero ya no
// bloquean el cobro automático ni se defienden de la suscripción.
export const DEVUELTOS = ["refunded", "charged_back"];

/**
 * El pago por adelantado que cubre hoy, si hay uno: el aplicado y no devuelto
 * que termina más tarde. Su `period_end` ya incluye todo lo que la ficha tenía cuando se
 * aplicó, porque los meses se suman al final del plan vigente.
 */
export function adelantoVigente(pagos, ahora = new Date()) {
  let mejor = null;
  for (const pago of pagos ?? []) {
    const hasta = fecha(pago?.period_end);
    if (!pago?.applied_at || !hasta || hasta.getTime() <= ahora.getTime()) continue;
    if (DEVUELTOS.includes(pago.status)) continue;
    if (!planDePagaValido(pago.plan)) continue;
    if (!mejor || hasta.getTime() > fecha(mejor.period_end).getTime()) mejor = pago;
  }
  return mejor;
}

// Con el cobro automático andando no se ofrece pagar por adelantado: serían
// dos cobros por el mismo mes. Una suscripción en pending no cuenta, porque
// nunca se cobró; pagar por adelantado la cancela.
export function cobroAutomaticoActivo(suscripcion) {
  return ["authorized", "paused"].includes(suscripcion?.status);
}

export function mesesLegibles(meses) {
  return Number(meses) === 1 ? "1 mes" : `${meses} meses`;
}

// Cómo pagó, en palabras del dueño. Las claves son `payment_type_id` de la
// pasarela; "ticket" en México es OXXO y las demás tiendas de conveniencia.
const MEDIOS = {
  ticket: "en OXXO",
  bank_transfer: "por SPEI",
  atm: "en cajero",
  account_money: "con saldo de Mercado Pago",
  credit_card: "con tarjeta",
  debit_card: "con tarjeta",
  prepaid_card: "con tarjeta",
};

export function medioLegible(method) {
  return MEDIOS[String(method ?? "")] ?? "";
}
