import { test } from "node:test";
import assert from "node:assert/strict";
import { planesParaElegir } from "../../lib/opciones-de-pago.js";

const porSlug = (lista) => Object.fromEntries(lista.map((p) => [p.slug, p]));

test("una ficha en Básico sin pagos puede pagar cualquier plan de las dos formas", () => {
  const planes = porSlug(planesParaElegir({ vigente: "basico", suscripcion: null, viva: false, adelanto: null, porCobrar: null }));
  assert.deepEqual(Object.keys(planes), ["plus", "premium", "pedidos"]);
  for (const p of Object.values(planes)) {
    assert.equal(p.mensual, true);
    assert.equal(p.sinMensual, null);
    assert.deepEqual(
      p.adelantos.map((a) => a.meses),
      [1, 3, 6, 12],
    );
    assert.equal(p.actual, false);
  }
  assert.equal(planes.plus.precioMensual, "$199");
  assert.equal(planes.plus.adelantos[1].total, "$597");
  // Lo que pasa del tope de OXXO lo dice ahí mismo.
  assert.equal(planes.pedidos.adelantos.find((a) => a.meses === 6).sinOxxo, true);
  assert.equal(planes.pedidos.adelantos.find((a) => a.meses === 3).sinOxxo, false);
});

test("con meses pagados por adelantado no hay cobro mensual, y por adelantado solo se mantiene o se sube", () => {
  const planes = porSlug(
    planesParaElegir({ vigente: "premium", suscripcion: null, viva: false, adelanto: { plan: "premium" }, porCobrar: null }),
  );
  for (const p of Object.values(planes)) {
    assert.equal(p.mensual, false);
    assert.match(p.sinMensual, /por adelantado/);
  }
  assert.equal(planes.plus.adelantos.length, 0);
  assert.match(planes.plus.sinAdelanto, /para bajar/);
  assert.equal(planes.premium.adelantos.length, 4);
  assert.equal(planes.premium.actual, true);
  assert.equal(planes.pedidos.adelantos.length, 4);
});

test("con el cobro automático activo no se paga por adelantado, ni se contrata el mismo plan", () => {
  const suscripcion = { plan: "plus", status: "authorized" };
  const planes = porSlug(planesParaElegir({ vigente: "plus", suscripcion, viva: true, adelanto: null, porCobrar: null }));
  assert.equal(planes.plus.mensual, false);
  assert.equal(planes.plus.sinMensual, "Ya lo pagas cada mes con tarjeta.");
  assert.equal(planes.premium.mensual, true);
  assert.equal(planes.pedidos.mensual, true);
  for (const p of Object.values(planes)) {
    assert.equal(p.adelantos.length, 0);
    assert.match(p.sinAdelanto, /cobro automático activo/);
  }
});

test("una ficha de OXXO por pagar fija el plan y apaga el cobro mensual", () => {
  const planes = porSlug(
    planesParaElegir({ vigente: "basico", suscripcion: null, viva: false, adelanto: null, porCobrar: { plan: "premium" } }),
  );
  for (const p of Object.values(planes)) assert.equal(p.mensual, false);
  assert.equal(planes.premium.adelantos.length, 4);
  assert.equal(planes.plus.adelantos.length, 0);
  assert.match(planes.plus.sinAdelanto, /de otro plan/);
  assert.equal(planes.pedidos.adelantos.length, 0);
});

test("una suscripción cancelada que sigue corriendo no bloquea pagar por adelantado", () => {
  const suscripcion = { plan: "premium", status: "cancelled" };
  const planes = porSlug(planesParaElegir({ vigente: "premium", suscripcion, viva: false, adelanto: null, porCobrar: null }));
  assert.equal(planes.premium.mensual, false);
  assert.equal(planes.premium.sinMensual, "Es el plan que ya tienes.");
  assert.equal(planes.premium.adelantos.length, 4);
  assert.equal(planes.plus.adelantos.length, 0);
});
