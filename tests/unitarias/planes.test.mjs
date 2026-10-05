import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLANES,
  asistenteIncluido,
  premiumIncluido,
  planVigente,
  menusIncluidos,
  fotosPlatillosIncluidas,
  nombreDelPlan,
} from "../../lib/planes.js";

const manana = new Date(Date.now() + 86400000).toISOString();
const ayer = new Date(Date.now() - 86400000).toISOString();

test("los números coinciden con menus_incluidos de la base", () => {
  const porSlug = Object.fromEntries(PLANES.map((p) => [p.slug, p.menus]));
  assert.deepEqual(porSlug, { basico: 5, plus: 10, premium: 30, pedidos: 100 });
});

test("un plan de paga vencido es básico", () => {
  assert.equal(planVigente({ plan: "premium", premium_until: manana }), "premium");
  assert.equal(planVigente({ plan: "premium", premium_until: ayer }), "basico");
  assert.equal(planVigente({ plan: "plus", premium_until: manana }), "plus");
  assert.equal(planVigente({ plan: "basico" }), "basico");
  assert.equal(planVigente(null), "basico");
  assert.equal(planVigente({ plan: "inventado", premium_until: manana }), "basico");
});

test("los cupos siguen al plan vigente", () => {
  assert.equal(menusIncluidos({ plan: "plus", premium_until: manana }), 10);
  assert.equal(menusIncluidos({ plan: "plus", premium_until: ayer }), 5);
  assert.equal(fotosPlatillosIncluidas({ plan: "premium", premium_until: manana }), 20);
  assert.equal(nombreDelPlan({ plan: "premium", premium_until: ayer }), "Básico");
});

test("Pedidos incluye lo de Premium, y el asistente es solo de Pedidos", () => {
  const pedidos = { plan: "pedidos", premium_until: manana };
  assert.equal(planVigente(pedidos), "pedidos");
  assert.equal(menusIncluidos(pedidos), 100);
  assert.equal(nombreDelPlan(pedidos), "Pedidos");
  assert.equal(premiumIncluido(pedidos), true);
  assert.equal(premiumIncluido({ plan: "premium", premium_until: manana }), true);
  assert.equal(premiumIncluido({ plan: "plus", premium_until: manana }), false);
  assert.equal(asistenteIncluido(pedidos), true);
  assert.equal(asistenteIncluido({ plan: "premium", premium_until: manana }), false);
  // Vencido, no queda ni el asistente ni lo de Premium.
  assert.equal(asistenteIncluido({ plan: "pedidos", premium_until: ayer }), false);
  assert.equal(premiumIncluido({ plan: "pedidos", premium_until: ayer }), false);
  assert.equal(asistenteIncluido(null), false);
});
