import { test } from "node:test";
import assert from "node:assert/strict";
import { promedioDe, resumenVerificadas, ordenarResenas } from "../../lib/pases.js";

const lista = [
  { id: "a", rating: 5, created_at: "2026-09-01T00:00:00Z", verified_at: null },
  { id: "b", rating: 3, created_at: "2026-09-03T00:00:00Z", verified_at: "2026-09-03T01:00:00Z" },
  { id: "c", rating: 4, created_at: "2026-09-02T00:00:00Z", verified_at: "2026-09-02T01:00:00Z" },
];

test("el promedio de las verificadas va aparte", () => {
  assert.equal(promedioDe([]), null);
  assert.equal(promedioDe(lista), 4);
  const r = resumenVerificadas(lista);
  assert.deepEqual(r, { total: 3, verificadas: 2, promedioVerificadas: 3.5, promedioTodas: 4 });
});

test("filtrar y ordenar por verificadas sin esconder las demás por defecto", () => {
  assert.deepEqual(ordenarResenas(lista).map((r) => r.id), ["b", "c", "a"]);
  assert.deepEqual(ordenarResenas(lista, { verificadasPrimero: true }).map((r) => r.id), ["b", "c", "a"]);
  const conNormalReciente = [...lista, { id: "d", rating: 1, created_at: "2026-09-09T00:00:00Z", verified_at: null }];
  assert.deepEqual(ordenarResenas(conNormalReciente).map((r) => r.id)[0], "d");
  assert.deepEqual(ordenarResenas(conNormalReciente, { verificadasPrimero: true }).map((r) => r.id), ["b", "c", "d", "a"]);
  assert.deepEqual(ordenarResenas(lista, { soloVerificadas: true }).map((r) => r.id), ["b", "c"]);
});
