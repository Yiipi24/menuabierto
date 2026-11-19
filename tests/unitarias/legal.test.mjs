import { test } from "node:test";
import assert from "node:assert/strict";
import { RESPONSABLE, datosPendientes, fechaLegible, quienResponde } from "../../lib/legal.js";
import { segmentoReservado } from "../../lib/slug.js";

test("datosPendientes nombra lo que le falta al aviso", () => {
  assert.deepEqual(datosPendientes({ ...RESPONSABLE, nombre: null, domicilio: null, ciudadTribunales: null }), [
    "nombre o razón social del responsable",
    "domicilio del responsable",
    "ciudad de los tribunales",
  ]);
  assert.deepEqual(
    datosPendientes({ ...RESPONSABLE, nombre: "Ana López", domicilio: "Calle 1, Centro", ciudadTribunales: "Monterrey" }),
    [],
  );
});

test("quienResponde usa el nombre legal y cae a la marca mientras falta", () => {
  assert.equal(quienResponde({ ...RESPONSABLE, nombre: null }), "Menú Abierto");
  assert.equal(quienResponde({ ...RESPONSABLE, nombre: "Ana López" }), "Ana López (Menú Abierto)");
});

test("fechaLegible no se corre un día por la zona horaria", () => {
  assert.equal(fechaLegible("2026-11-19"), "19 de noviembre de 2026");
  assert.equal(fechaLegible("2027-01-01"), "1 de enero de 2027");
});

test("ningún restaurante puede quedarse con /privacidad ni /terminos", () => {
  assert.equal(segmentoReservado("privacidad"), true);
  assert.equal(segmentoReservado("terminos"), true);
});
