import { test } from "node:test";
import assert from "node:assert/strict";
import { aCentavos, aTextoDePrecio, pesos } from "../../lib/precios.js";

test("aCentavos lee lo que el dueño escribe", () => {
  assert.equal(aCentavos("89"), 8900);
  assert.equal(aCentavos("89.50"), 8950);
  assert.equal(aCentavos("$89.50"), 8950);
  assert.equal(aCentavos("1,250.00"), 125000);
  assert.equal(aCentavos("89,50"), 8950);
  assert.equal(aCentavos(" 12 "), 1200);
});

test("aCentavos distingue vacío de mal escrito", () => {
  assert.equal(aCentavos(""), null);
  assert.equal(aCentavos(null), null);
  assert.equal(aCentavos("abc"), undefined);
  assert.equal(aCentavos("-5"), 500); // el signo se limpia, no es negativo
  assert.equal(aCentavos("100001"), undefined);
});

test("aTextoDePrecio vuelve al campo del formulario", () => {
  assert.equal(aTextoDePrecio(8900), "89");
  assert.equal(aTextoDePrecio(8950), "89.50");
  assert.equal(aTextoDePrecio(null), "");
});

test("pesos formatea en es-MX sin decimales de más", () => {
  assert.equal(pesos(null), null);
  assert.match(pesos(8900), /^\$89$/);
  assert.match(pesos(8950), /^\$89\.50$/);
  assert.match(pesos(125000), /^\$1,250$/);
});
