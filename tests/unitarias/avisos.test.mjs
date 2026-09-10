import { test } from "node:test";
import assert from "node:assert/strict";
import { prefsDe, prefsParaGuardar, pushPermitido, textoDePush, suscripcionValida } from "../../lib/avisos.js";

test("las preferencias: lo que falta está encendido, solo false apaga", () => {
  assert.deepEqual(prefsDe(null), { historia: true, resena: true, respuesta: true, insignia: true });
  assert.equal(prefsDe({ historia: false, otra: false }).historia, false);
  assert.equal(prefsDe({ historia: "no" }).historia, true);
  assert.deepEqual(prefsParaGuardar({ historia: false, resena: true, insignia: false }), { historia: false, insignia: false });
  assert.equal(pushPermitido({}, "resena"), true);
  assert.equal(pushPermitido({ resena: false }, "resena"), false);
  assert.equal(pushPermitido({}, "inventado"), false);
});

test("cada tipo de aviso tiene su texto y su destino", () => {
  const h = textoDePush({ kind: "historia", restaurant_name: "Tacos", restaurant_slug: "tacos", post_id: "p1" });
  assert.equal(h.titulo, "Tacos");
  assert.equal(h.url, "/tacos");
  const i = textoDePush({ kind: "insignia", badge_slug: "catador" });
  assert.match(i.titulo, /Catador/);
  assert.equal(i.url, "/panel/insignias");
  const r = textoDePush({ kind: "resena", review_author: "Ana", review_rating: 5, restaurant_name: "Tacos", restaurant_id: "r1", review_excerpt: "Rico" });
  assert.equal(r.url, "/panel/r1/resenas");
  assert.equal(r.cuerpo, "“Rico”");
  assert.equal(textoDePush({ kind: "x" }), null);
});

test("la suscripción del navegador se comprueba antes de guardarla", () => {
  const ok = suscripcionValida({ endpoint: "https://fcm.googleapis.com/fcm/send/abcdefghijklmnop", keys: { p256dh: "B".repeat(87), auth: "a1b2c3d4e5f6g7h8i9j0kl" } });
  assert.ok(ok);
  assert.equal(suscripcionValida({ endpoint: "http://x", keys: {} }), null);
  assert.equal(suscripcionValida(null), null);
});
