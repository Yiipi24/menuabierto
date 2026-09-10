import { test } from "node:test";
import assert from "node:assert/strict";
import { combinaMetricas, sujetoDeSeleccion, periodoPorSlug, KPIS } from "../../lib/metricas.js";
import { EVENTOS, eventoValido, fuenteValida, fuenteDeReferente } from "../../lib/eventos.js";

test("cada KPI con evento apunta a un evento que existe", () => {
  for (const k of KPIS) {
    if (k.evento) assert.ok(EVENTOS.includes(k.evento), k.evento);
  }
  assert.equal(eventoValido("qr_scan"), true);
  assert.equal(eventoValido("inventado"), false);
  assert.equal(fuenteValida("qr"), "qr");
  assert.equal(fuenteValida("x"), "directo");
});

test("la fuente se deduce del referente", () => {
  assert.equal(fuenteDeReferente("https://m.facebook.com/x", "menuabierto.com"), "redes");
  assert.equal(fuenteDeReferente("https://menuabierto.com/comida/tacos", "menuabierto.com"), "busqueda");
  assert.equal(fuenteDeReferente("https://www.google.com/", "menuabierto.com"), "directo");
  assert.equal(fuenteDeReferente("no es url", "menuabierto.com"), "directo");
  assert.equal(fuenteDeReferente("", "menuabierto.com"), "directo");
});

test("periodoPorSlug cae en la semana", () => {
  assert.equal(periodoPorSlug("hoy").slug, "hoy");
  assert.equal(periodoPorSlug("nada").slug, "7d");
});

const uno = {
  paso: "day",
  totales: { restaurant_view: 10, qr_scan: 2 },
  previos: { restaurant_view: 5 },
  fuentes: { qr: 2, directo: 8 },
  serie: [{ t: "a", valor: 4 }, { t: "b", valor: 6 }],
  lugares: [{ nombre: "Centro", valor: 3 }],
  seguidores: { total: 4, nuevos: 1, previos: 0 },
  favoritos: { total: 0, nuevos: 0, previos: 0 },
  cartas: [{ id: 1 }],
};
const dos = {
  ...uno,
  totales: { restaurant_view: 1 },
  serie: [{ t: "a", valor: 1 }, { t: "b", valor: 1 }, { t: "c", valor: 1 }],
  lugares: [{ nombre: "Centro", valor: 1 }, { nombre: "Norte", valor: 9 }],
};

test("combinaMetricas suma varias fichas como una", () => {
  assert.equal(combinaMetricas([]), null);
  assert.equal(combinaMetricas([uno, null]), uno);
  const c = combinaMetricas([uno, dos]);
  assert.equal(c.totales.restaurant_view, 11);
  assert.equal(c.totales.qr_scan, 2);
  assert.deepEqual(c.serie.map((p) => p.valor), [5, 7, 1]);
  assert.equal(c.lugares[0].nombre, "Norte");
  assert.equal(c.lugares.find((l) => l.nombre === "Centro").valor, 4);
  assert.equal(c.seguidores.total, 8);
  assert.deepEqual(c.cartas, []);
  assert.equal(c.ficha, null);
});

test("sujetoDeSeleccion pondera la calificación por reseñas", () => {
  const a = { id: "a", rating_count: 3, rating_avg: 5, fotos: 2, status: "borrador" };
  const b = { id: "b", rating_count: 200, rating_avg: 4, fotos: 0, status: "publicado" };
  assert.equal(sujetoDeSeleccion([a]), a);
  const s = sujetoDeSeleccion([a, b]);
  assert.equal(s.id, "b");
  assert.equal(s.status, "publicado");
  assert.equal(s.fotos, 0);
  assert.ok(Math.abs(s.rating_avg - (15 + 800) / 203) < 1e-9);
});
