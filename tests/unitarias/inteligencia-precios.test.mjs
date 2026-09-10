import { test } from "node:test";
import assert from "node:assert/strict";
import { diferenciaPct, posicionFrenteA, leerPosicion, rangoLegible, topeEnCentavos } from "../../lib/inteligencia-precios.js";

test("la diferencia se lee en porcentaje contra la referencia", () => {
  assert.equal(diferenciaPct(12000, 10000), 20);
  assert.equal(diferenciaPct(8000, 10000), -20);
  assert.equal(diferenciaPct(8000, null), null);
  assert.equal(diferenciaPct(8000, 0), null);
});

test("la posición avisa a partir del umbral y calla sin mínimo", () => {
  const alta = posicionFrenteA(13000, 10000, "la colonia Centro");
  assert.equal(alta.pct, 30);
  assert.equal(alta.aviso, true);
  assert.match(alta.texto, /30% por encima/);
  const leve = posicionFrenteA(10500, 10000, "Centro");
  assert.equal(leve.aviso, false);
  const sin = posicionFrenteA(10500, null, "Centro");
  assert.equal(sin.pct, null);
  assert.match(sin.texto, /no hay suficientes/);
});

test("leerPosicion arma la tarjeta del dueño", () => {
  assert.equal(leerPosicion({ mi_mediana: null }).lista, false);
  const p = leerPosicion({
    mi_mediana: 15000,
    mis_platillos: 12,
    minimo: 3,
    zona: { nivel: "ciudad", nombre: "Monterrey", n: 8, mediana: 10000 },
    cocina: { nombre: "Tacos", n: 2, mediana: null },
  });
  assert.equal(p.lista, true);
  assert.equal(p.zona.pct, 50);
  assert.equal(p.aviso, true);
  assert.equal(p.cocina.pct, null);
});

test("rango y tope", () => {
  assert.equal(rangoLegible(8000, 15000), "$80 – $150");
  assert.equal(rangoLegible(null, 15000), null);
  assert.equal(topeEnCentavos("$30"), 3000);
  assert.equal(topeEnCentavos(""), null);
  assert.equal(topeEnCentavos("abc"), null);
});
