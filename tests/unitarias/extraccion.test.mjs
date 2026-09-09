import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESQUEMA_CARTA,
  lecturasIncluidas,
  tipoDeEntrada,
  normalizarExtraccion,
  resumenDeExtraccion,
  leerRevision,
  MAX_PLATILLOS,
} from "../../lib/extraccion.js";

const manana = new Date(Date.now() + 86400000).toISOString();

test("el cupo de lecturas sigue al plan vigente", () => {
  assert.equal(lecturasIncluidas({ plan: "basico" }), 3);
  assert.equal(lecturasIncluidas({ plan: "premium", premium_until: manana }), 50);
  assert.equal(lecturasIncluidas({ plan: "premium", premium_until: "2020-01-01" }), 3);
});

test("solo entran imágenes que la API acepta y PDF", () => {
  assert.equal(tipoDeEntrada("image/jpeg"), "image");
  assert.equal(tipoDeEntrada("application/pdf"), "document");
  assert.equal(tipoDeEntrada("image/avif"), null);
  assert.equal(tipoDeEntrada("text/plain"), null);
});

test("el esquema es estricto y con los precios como texto", () => {
  assert.equal(ESQUEMA_CARTA.additionalProperties, false);
  const platillo = ESQUEMA_CARTA.properties.secciones.items.properties.platillos.items;
  assert.deepEqual(platillo.required, ["nombre", "descripcion", "precio"]);
  assert.deepEqual(platillo.properties.precio.type, ["string", "null"]);
});

test("normalizarExtraccion limpia lo que devuelve el modelo", () => {
  const e = normalizarExtraccion({
    legible: true,
    motivo: null,
    moneda: "MXN",
    secciones: [
      {
        nombre: "  Tacos ",
        platillos: [
          { nombre: "Pastor", descripcion: "Con piña", precio: "25" },
          { nombre: "Suadero", descripcion: null, precio: "1,250.00" },
          { nombre: "", descripcion: null, precio: "10" },
          { nombre: "Campechano", descripcion: null, precio: "veinte" },
          { nombre: "Sin precio", descripcion: null, precio: null },
        ],
      },
      { nombre: "Vacía", platillos: [] },
    ],
  });
  assert.equal(e.legible, true);
  assert.equal(e.secciones.length, 1, "la sección vacía no entra");
  assert.equal(e.secciones[0].nombre, "Tacos");
  const [pastor, suadero, campechano, sinPrecio] = e.secciones[0].platillos;
  assert.equal(pastor.precio, 2500);
  assert.equal(suadero.precio, 125000);
  assert.equal(campechano.precio, null);
  assert.equal(campechano.dudoso, true, "un precio que no se entiende se marca, no se inventa");
  assert.equal(sinPrecio.precio, null);
  assert.equal(sinPrecio.dudoso, false);
  assert.deepEqual(resumenDeExtraccion(e), { secciones: 1, platillos: 4, conPrecio: 2, sinPrecio: 2 });
});

test("una lectura sin platillos o marcada ilegible no es legible", () => {
  assert.equal(normalizarExtraccion({ legible: true, secciones: [] }).legible, false);
  const ilegible = normalizarExtraccion({ legible: false, motivo: "Está borrosa", secciones: [] });
  assert.equal(ilegible.legible, false);
  assert.equal(ilegible.motivo, "Está borrosa");
  assert.equal(normalizarExtraccion(null).legible, false);
  assert.equal(normalizarExtraccion({ legible: true, moneda: "pesos", secciones: [] }).moneda, "MXN");
});

test("los topes cortan a un modelo que se fue por las ramas", () => {
  const muchos = Array.from({ length: MAX_PLATILLOS + 50 }, (_, i) => ({ nombre: `P${i}`, descripcion: null, precio: "1" }));
  const e = normalizarExtraccion({ legible: true, secciones: [{ nombre: "Todo", platillos: muchos }] });
  assert.equal(resumenDeExtraccion(e).platillos, MAX_PLATILLOS);
});

test("leerRevision respeta lo que el dueño marcó y corrigió", () => {
  const ok = leerRevision(
    JSON.stringify({
      secciones: [
        {
          nombre: "Tacos",
          platillos: [
            { incluir: true, nombre: "Pastor", descripcion: "", precio: "28" },
            { incluir: false, nombre: "Suadero", descripcion: null, precio: "25" },
            { incluir: true, nombre: "X", descripcion: null, precio: "5" },
          ],
        },
        { nombre: "Bebidas", platillos: [{ incluir: false, nombre: "Agua", precio: "20" }] },
      ],
    }),
  );
  assert.equal(ok.total, 1);
  assert.equal(ok.secciones.length, 1, "una sección sin platillos marcados no se crea");
  assert.deepEqual(ok.secciones[0].platillos[0], { nombre: "Pastor", descripcion: null, precio: 2800 });

  assert.match(leerRevision({ secciones: [{ nombre: "T", platillos: [{ nombre: "Pastor", precio: "abc" }] }] }).error, /precio de "Pastor"/);
  assert.match(leerRevision({ secciones: [] }).error, /ningún platillo/);
  assert.match(leerRevision("{no json").error, /mala forma/);
  assert.match(leerRevision({ secciones: [{ nombre: "", platillos: [{ nombre: "Pastor", precio: "" }] }] }).error, /necesita nombre/);
});
