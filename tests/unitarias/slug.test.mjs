import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aSegmento,
  slugValido,
  slugDisponible,
  rutaFicha,
  rutaMenu,
  rutaMenuCarta,
  uuidValido,
  qrCodigoValido,
  segmentoReservado,
} from "../../lib/slug.js";

test("aSegmento pega el nombre y quita acentos", () => {
  assert.equal(aSegmento("JC Smoke House"), "jcsmokehouse");
  assert.equal(aSegmento("Tacos Doña Ñora"), "tacosdonanora");
  assert.equal(aSegmento("¡El Güero! #1"), "elguero1");
  assert.equal(aSegmento("").length, 0);
  assert.equal(aSegmento("a".repeat(80)).length, 60);
});

test("slugValido acepta uno o dos tramos y rechaza las rutas fijas", () => {
  assert.equal(slugValido("jcsmokehouse"), true);
  assert.equal(slugValido("tacoselgordo/centro"), true);
  assert.equal(slugValido("panel"), false);
  assert.equal(slugValido("comida"), false);
  assert.equal(slugValido("tacos/menu"), false);
  assert.equal(slugValido("a/b/c"), false);
  assert.equal(slugValido("con-guion"), false);
  assert.equal(slugValido(""), false);
});

test("las rutas fijas del sitio están reservadas", () => {
  for (const r of ["api", "panel", "entrar", "comida", "q", "r", "sitemap", "robots", "_next"]) {
    assert.equal(segmentoReservado(r), true, r);
  }
});

test("slugDisponible prueba nombre, colonia y número, en ese orden", async () => {
  const tomados = new Set(["tacoselgordo", "tacoselgordo/centro", "tacoselgordo/centro2"]);
  const tomado = async (s) => tomados.has(s);

  assert.equal(await slugDisponible("Tacos El Gordo", "Centro", tomado), "tacoselgordo/centro3");
  assert.equal(await slugDisponible("Nuevo", "Centro", tomado), "nuevo");
  assert.equal(await slugDisponible("Panel", "", tomado), "panelrestaurante");
  assert.equal(await slugDisponible("", "", tomado), "restaurante");
});

test("las rutas codifican cada tramo por separado", () => {
  assert.equal(rutaFicha("tacoselgordo/centro"), "/tacoselgordo/centro");
  assert.equal(rutaMenu("jcsmokehouse"), "/jcsmokehouse/menu");
  assert.equal(
    rutaMenuCarta("jcsmokehouse", "0b1c2d3e-4f50-4172-8394-a5b6c7d8e9f0"),
    "/jcsmokehouse/menu/0b1c2d3e-4f50-4172-8394-a5b6c7d8e9f0",
  );
});

test("uuid y código de QR se validan antes de ir a la base", () => {
  assert.equal(uuidValido("0b1c2d3e-4f50-4172-8394-a5b6c7d8e9f0"), true);
  assert.equal(uuidValido("loquesea"), false);
  assert.equal(qrCodigoValido("k7mn3p"), true);
  assert.equal(qrCodigoValido("AB"), false);
});
