import { test } from "node:test";
import assert from "node:assert/strict";
import { leerRespuesta, extractoDe, textoDeAviso, motivoValido, MAX_RESPUESTA } from "../../lib/resenas.js";

test("la respuesta se limpia y vacía significa quitarla", () => {
  assert.deepEqual(leerRespuesta("  Gracias por venir  "), { texto: "Gracias por venir" });
  assert.deepEqual(leerRespuesta("   "), { texto: null });
  assert.match(leerRespuesta("x".repeat(MAX_RESPUESTA + 1)).error, /demasiado larga/);
});

test("el extracto corta en una palabra", () => {
  assert.equal(extractoDe("Muy rico todo"), "Muy rico todo");
  const largo = extractoDe("Los tacos estaban buenísimos y el servicio muy rápido, volveremos seguro", 30);
  assert.ok(largo.endsWith("…"));
  assert.ok(largo.length <= 31);
  assert.doesNotMatch(largo, /\s…$/);
});

test("los avisos de reseña se leen como frases", () => {
  const nueva = textoDeAviso({ kind: "resena", review_author: "Ana", review_rating: 5, restaurant_name: "Tacos", restaurant_id: "r1", review_excerpt: "Muy rico" });
  assert.equal(nueva.titulo, "Ana te dejó 5 estrellas en Tacos.");
  assert.equal(nueva.href, "/panel/r1/resenas");
  const respuesta = textoDeAviso({ kind: "respuesta", restaurant_name: "Tacos", restaurant_slug: "tacos", review_excerpt: "Gracias" });
  assert.equal(respuesta.titulo, "Tacos respondió a tu reseña.");
  assert.equal(respuesta.href, "/tacos#resenas");
  assert.equal(textoDeAviso({ kind: "historia" }), null);
  assert.equal(motivoValido("falsa"), true);
  assert.equal(motivoValido("x"), false);
});
