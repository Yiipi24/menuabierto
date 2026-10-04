import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estadoDesdeSuscripcion,
  firmaValida,
  firmar,
  manifiestoDeFirma,
  idDeSuscripcionEnAviso,
  leerReferencia,
  referenciaExterna,
  planDePagaValido,
  precioDe,
  DIAS_DE_GRACIA,
  DIAS_PARA_PAGAR,
  MESES_POR_ADELANTADO,
  adelantoVigente,
  cobroAutomaticoActivo,
  estadoDePagoConocido,
  idDePagoEnAviso,
  leerOpcionDeAdelanto,
  leerReferenciaDeAdelanto,
  medioLegible,
  mesesLegibles,
  mesesValidos,
  opcionDeAdelanto,
  pagoPorCobrar,
  referenciaDeAdelanto,
  totalPorAdelantado,
} from "../../lib/cobro.js";

const DIA = 86400000;
const ahora = new Date("2026-09-09T12:00:00Z");
const en30 = new Date(ahora.getTime() + 30 * DIA);

test("solo plus y premium se cobran, y con precio", () => {
  assert.equal(planDePagaValido("plus"), true);
  assert.equal(planDePagaValido("basico"), false);
  assert.ok(precioDe("plus") > 0);
  assert.ok(precioDe("premium") > precioDe("plus"));
  assert.equal(precioDe("basico"), null);
});

test("authorized sube el plan hasta el siguiente cobro más la gracia", () => {
  const e = estadoDesdeSuscripcion(
    { status: "authorized", plan: "plus", next_payment_date: en30.toISOString() },
    { plan: "basico", premium_until: null },
    ahora,
  );
  assert.equal(e.plan, "plus");
  assert.equal(e.premium_until.getTime(), en30.getTime() + DIAS_DE_GRACIA * DIA);
});

test("paused conserva la vigencia que ya había, y sin vigencia no da nada", () => {
  const hasta = new Date(ahora.getTime() + 5 * DIA);
  const e = estadoDesdeSuscripcion(
    { status: "paused", plan: "plus", next_payment_date: en30.toISOString() },
    { plan: "plus", premium_until: hasta.toISOString() },
    ahora,
  );
  assert.equal(e.plan, "plus");
  assert.equal(e.premium_until.getTime(), hasta.getTime());

  const sin = estadoDesdeSuscripcion({ status: "paused", plan: "plus" }, { premium_until: null }, ahora);
  assert.equal(sin.plan, "basico");
});

test("cancelled respeta lo pagado sin regalar días y sin borrar datos", () => {
  const pagadoHasta = new Date(ahora.getTime() + 10 * DIA);
  const e = estadoDesdeSuscripcion(
    { status: "cancelled", plan: "premium", next_payment_date: pagadoHasta.toISOString() },
    { plan: "premium", premium_until: new Date(pagadoHasta.getTime() + 7 * DIA).toISOString() },
    ahora,
  );
  assert.equal(e.plan, "premium");
  assert.equal(e.premium_until.getTime(), pagadoHasta.getTime());

  const vencida = estadoDesdeSuscripcion(
    { status: "cancelled", plan: "premium", next_payment_date: new Date(ahora.getTime() - DIA).toISOString() },
    { plan: "premium", premium_until: ahora.toISOString() },
    ahora,
  );
  assert.equal(vencida.plan, "basico");
  assert.equal(vencida.premium_until, null);
});

test("cancelar una suscripción que nunca se pagó no regala el plan", () => {
  const e = estadoDesdeSuscripcion(
    { status: "cancelled", plan: "premium", next_payment_date: en30.toISOString() },
    { plan: "basico", premium_until: null },
    ahora,
  );
  assert.equal(e.plan, "basico");
  assert.equal(e.premium_until, null);
});

test("pending y estados desconocidos no tocan la ficha", () => {
  assert.equal(estadoDesdeSuscripcion({ status: "pending", plan: "plus" }, {}, ahora).plan, null);
  assert.equal(estadoDesdeSuscripcion({ status: "rarísimo", plan: "plus" }, {}, ahora), null);
  assert.equal(estadoDesdeSuscripcion({ status: "authorized", plan: "basico" }, {}, ahora), null);
});

test("la referencia externa viaja y vuelve", () => {
  const id = "0b1c2d3e-4f50-4172-8394-a5b6c7d8e9f0";
  assert.deepEqual(leerReferencia(referenciaExterna(id, "premium")), { restauranteId: id, plan: "premium" });
  assert.equal(leerReferencia("cualquier cosa"), null);
  assert.equal(leerReferencia(`${id}:basico`), null);
});

test("la firma del webhook se comprueba con la plantilla de Mercado Pago", () => {
  const secreto = "s3cr3t0";
  const ts = String(Math.floor(ahora.getTime() / 1000));
  const dataId = "ABC123";
  const requestId = "req-1";
  const manifiesto = manifiestoDeFirma({ dataId, requestId, ts });
  assert.equal(manifiesto, `id:abc123;request-id:req-1;ts:${ts};`);

  const v1 = firmar(manifiesto, secreto);
  const cabecera = `ts=${ts},v1=${v1}`;
  const base = { cabecera, requestId, dataId, secreto, ahora: ahora.getTime() };

  assert.equal(firmaValida(base), true);
  assert.equal(firmaValida({ ...base, secreto: "otro" }), false);
  assert.equal(firmaValida({ ...base, dataId: "otro" }), false);
  assert.equal(firmaValida({ ...base, cabecera: `ts=${ts},v1=${"0".repeat(64)}` }), false);
  assert.equal(firmaValida({ ...base, ahora: ahora.getTime() + 10 * 60 * 1000 }), false, "vieja");
  assert.equal(firmaValida({ ...base, secreto: "" }), false);
});

test("del aviso se saca la suscripción o el cobro, y lo demás se ignora", () => {
  assert.deepEqual(idDeSuscripcionEnAviso({ type: "subscription_preapproval", data: { id: "x1" } }), {
    clase: "suscripcion",
    id: "x1",
  });
  assert.deepEqual(idDeSuscripcionEnAviso({ type: "subscription_authorized_payment", data: { id: 9 } }), {
    clase: "cobro",
    id: "9",
  });
  assert.equal(idDeSuscripcionEnAviso({ type: "payment", data: { id: "p" } }), null);
  assert.equal(idDeSuscripcionEnAviso({}), null);
});

// ---------------------------------------------------------------------------
// Pago por adelantado

const FICHA = "0b1c2d3e-4f50-4172-8394-a5b6c7d8e9f0";

test("por adelantado se pagan 1, 3, 6 o 12 meses, al precio del mes por los meses", () => {
  assert.deepEqual(MESES_POR_ADELANTADO, [1, 3, 6, 12]);
  assert.equal(mesesValidos(3), true);
  assert.equal(mesesValidos("12"), true);
  for (const malo of [0, 2, 13, -1, "3.5", "03x", "", null, "1e1"]) {
    assert.equal(mesesValidos(malo), false, String(malo));
  }
  assert.equal(totalPorAdelantado("plus", 3), precioDe("plus") * 3);
  assert.equal(totalPorAdelantado("premium", 12), precioDe("premium") * 12);
  assert.equal(totalPorAdelantado("basico", 3), null);
  assert.equal(totalPorAdelantado("plus", 2), null);
});

test("la opción del panel lleva plan y meses, y solo combinaciones válidas", () => {
  assert.deepEqual(leerOpcionDeAdelanto(opcionDeAdelanto("premium", 6)), { plan: "premium", meses: 6 });
  assert.equal(leerOpcionDeAdelanto("basico:3"), null);
  assert.equal(leerOpcionDeAdelanto("plus:5"), null);
  assert.equal(leerOpcionDeAdelanto("plus:3:extra"), null);
  assert.equal(leerOpcionDeAdelanto(null), null);
});

test("la referencia de un adelanto no se confunde con la de una suscripción", () => {
  const ref = referenciaDeAdelanto(FICHA, "plus", 3);
  assert.deepEqual(leerReferenciaDeAdelanto(ref), { restauranteId: FICHA, plan: "plus", meses: 3 });
  // Los cargos de la suscripción pueden llegar con la referencia de su
  // suscripción: no son meses comprados.
  assert.equal(leerReferenciaDeAdelanto(referenciaExterna(FICHA, "plus")), null);
  // Y al revés: un adelanto no se lee como suscripción.
  assert.equal(leerReferencia(ref), null);
  assert.equal(leerReferenciaDeAdelanto(`adelanto:no-es-uuid:plus:3`), null);
  assert.equal(leerReferenciaDeAdelanto(`adelanto:${FICHA}:plus:4`), null);
  assert.equal(leerReferenciaDeAdelanto(`adelanto:${FICHA}:plus:3:x`), null);
  assert.equal(leerReferenciaDeAdelanto(undefined), null);
});

test("del aviso de un pago se saca su id, que son solo dígitos", () => {
  assert.equal(idDePagoEnAviso({ type: "payment", data: { id: "123456789" } }), "123456789");
  assert.equal(idDePagoEnAviso({ type: "payment", data: { id: 42 } }), "42");
  assert.equal(idDePagoEnAviso({ type: "payment", data: { id: "../x" } }), null);
  assert.equal(idDePagoEnAviso({ type: "subscription_preapproval", data: { id: "1" } }), null);
  assert.equal(idDePagoEnAviso({ type: "payment" }), null);
});

test("solo los estados que conoce la tabla se registran", () => {
  assert.equal(estadoDePagoConocido("approved"), true);
  assert.equal(estadoDePagoConocido("pending"), true);
  assert.equal(estadoDePagoConocido("algo_nuevo"), false);
  assert.equal(estadoDePagoConocido(undefined), false);
});

test("una ficha de OXXO por pagar bloquea el cobro automático hasta que vence", () => {
  const vence = new Date(ahora.getTime() + DIA).toISOString();
  assert.equal(pagoPorCobrar({ status: "pending", expires_at: vence }, ahora), true);
  assert.equal(pagoPorCobrar({ status: "in_process", expires_at: vence }, ahora), true);
  assert.equal(
    pagoPorCobrar({ status: "pending", expires_at: new Date(ahora.getTime() - 1).toISOString() }, ahora),
    false,
    "vencida",
  );
  assert.equal(pagoPorCobrar({ status: "approved", expires_at: vence }, ahora), false);
  assert.equal(pagoPorCobrar({ status: "rejected" }, ahora), false);
  // Sin fecha de vencimiento, se da por vencida a los días de siempre.
  const reciente = new Date(ahora.getTime() - DIA).toISOString();
  const vieja = new Date(ahora.getTime() - (DIAS_PARA_PAGAR + 1) * DIA).toISOString();
  assert.equal(pagoPorCobrar({ status: "pending", created_at: reciente }, ahora), true);
  assert.equal(pagoPorCobrar({ status: "pending", created_at: vieja }, ahora), false);
  assert.equal(pagoPorCobrar({ status: "pending" }, ahora), false);
});

test("el adelanto vigente es el aplicado que termina más tarde", () => {
  const pagos = [
    { plan: "plus", applied_at: "x", period_end: new Date(ahora.getTime() + 10 * DIA).toISOString() },
    { plan: "plus", applied_at: "x", period_end: new Date(ahora.getTime() + 40 * DIA).toISOString() },
    { plan: "plus", applied_at: null, period_end: null, status: "pending" },
    { plan: "plus", applied_at: "x", period_end: new Date(ahora.getTime() - DIA).toISOString() },
  ];
  assert.equal(adelantoVigente(pagos, ahora), pagos[1]);
  assert.equal(adelantoVigente([pagos[2], pagos[3]], ahora), null);
  assert.equal(adelantoVigente(null, ahora), null);
  // Un pago devuelto ya no cubre: no bloquea el cobro automático.
  const devuelto = { ...pagos[1], status: "refunded" };
  assert.equal(adelantoVigente([pagos[0], devuelto], ahora), pagos[0]);
  assert.equal(adelantoVigente([{ ...pagos[0], status: "charged_back" }], ahora), null);
});

test("con el cobro automático andando no se ofrece pagar por adelantado", () => {
  assert.equal(cobroAutomaticoActivo({ status: "authorized" }), true);
  assert.equal(cobroAutomaticoActivo({ status: "paused" }), true);
  // Una suscripción en pending nunca se cobró: pagar por adelantado la cancela.
  assert.equal(cobroAutomaticoActivo({ status: "pending" }), false);
  assert.equal(cobroAutomaticoActivo({ status: "cancelled" }), false);
  assert.equal(cobroAutomaticoActivo(null), false);
});

test("el medio de pago se dice como lo diría el dueño", () => {
  assert.equal(medioLegible("ticket"), "en OXXO");
  assert.equal(medioLegible("bank_transfer"), "por SPEI");
  assert.equal(medioLegible("debit_card"), "con tarjeta");
  assert.equal(medioLegible("algo_nuevo"), "");
  assert.equal(medioLegible(null), "");
  assert.equal(mesesLegibles(1), "1 mes");
  assert.equal(mesesLegibles(6), "6 meses");
});
