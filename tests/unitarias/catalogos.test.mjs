import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogoDePagos, formasDePagoDe, detallesDePago } from "../../lib/pagos.js";
import { catalogoDeServicios, serviciosDe, modoDeServicio } from "../../lib/servicios.js";
import {
  insigniasGanadas,
  insigniaActual,
  siguienteInsignia,
  insigniaAlLlegar,
  progresoDe,
  conteoDe,
} from "../../lib/insignias.js";

const filas = [
  { slug: "efectivo", name: "Efectivo", hint: "", icon: null },
  { slug: "tarjeta", name: "Tarjeta", hint: "Visa y MasterCard", icon: "card" },
  { slug: null, name: "rota" },
];

test("el catálogo de pagos se traduce y se filtra en el orden de la tabla", () => {
  const catalogo = catalogoDePagos(filas);
  assert.equal(catalogo.length, 2);
  assert.equal(catalogo[0].icono, "efectivo");
  assert.equal(catalogo[1].icono, "card");
  assert.deepEqual(formasDePagoDe(catalogo, ["tarjeta", "efectivo", "inventado", " "]), ["efectivo", "tarjeta"]);
  assert.deepEqual(formasDePagoDe(catalogo, "no es lista"), []);
  assert.equal(detallesDePago(catalogo, ["tarjeta"])[0].nombre, "Tarjeta");
});

test("el catálogo de servicios sigue la misma regla", () => {
  const catalogo = catalogoDeServicios([{ slug: "wifi", name: "Wifi" }, { slug: "terraza" }]);
  assert.equal(catalogo[1].nombre, "Servicio");
  assert.deepEqual(serviciosDe(catalogo, ["terraza", "wifi", "x"]), ["wifi", "terraza"]);
  assert.equal(modoDeServicio("solo-llevar").nombre, "Solo para llevar");
  assert.equal(modoDeServicio("otro"), null);
});

test("las insignias se derivan del conteo de reseñas", () => {
  assert.equal(conteoDe(null), 0);
  assert.equal(conteoDe("3.7"), 3);
  assert.equal(insigniasGanadas(0).length, 0);
  assert.equal(insigniaActual(4).slug, "catador");
  assert.equal(siguienteInsignia(4).slug, "explorador");
  assert.equal(insigniaAlLlegar(5).slug, "explorador");
  assert.equal(insigniaAlLlegar(6), null);
  assert.equal(siguienteInsignia(100), null);
});

test("el progreso se mide desde la meta anterior", () => {
  const p = progresoDe(30);
  assert.equal(p.actual.slug, "critico");
  assert.equal(p.siguiente.slug, "embajador");
  assert.equal(p.faltan, 20);
  assert.equal(p.porcentaje, 20);
  assert.equal(progresoDe(150).porcentaje, 100);
});
