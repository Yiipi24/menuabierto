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
