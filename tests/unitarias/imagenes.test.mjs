import { test } from "node:test";
import assert from "node:assert/strict";
import { esDelAlmacenamiento, propsDeFoto, urlTransformada } from "../../lib/imagenes.js";

const ORIGINAL =
  "https://abc.supabase.co/storage/v1/object/public/restaurantes/r1/foto.png";
const RENDER = "https://abc.supabase.co/storage/v1/render/image/public/restaurantes/r1/foto.png";

test("solo se transforma lo que viene del almacenamiento", () => {
  assert.equal(esDelAlmacenamiento(ORIGINAL), true);
  assert.equal(esDelAlmacenamiento("/portada/hero.webp"), false);
  assert.equal(esDelAlmacenamiento("blob:https://menuabierto.com/123"), false);
  assert.equal(esDelAlmacenamiento(null), false);
});

test("urlTransformada cambia la ruta y pide ancho y calidad", () => {
  assert.equal(urlTransformada(ORIGINAL, 480), `${RENDER}?width=480&quality=70`);
  assert.equal(urlTransformada(ORIGINAL, 960, 80), `${RENDER}?width=960&quality=80`);
  assert.equal(urlTransformada("/portada/hero.webp", 480), "/portada/hero.webp");
});

test("urlTransformada respeta lo que ya traía la dirección", () => {
  assert.equal(urlTransformada(`${ORIGINAL}?v=2`, 480), `${RENDER}?v=2&width=480&quality=70`);
});

test("propsDeFoto arma srcset, sizes y un src de respaldo de en medio", () => {
  const p = propsDeFoto(ORIGINAL, { sizes: "100vw" });
  assert.equal(p.src, `${RENDER}?width=960&quality=70`);
  assert.equal(
    p.srcSet,
    `${RENDER}?width=480&quality=70 480w, ${RENDER}?width=960&quality=70 960w, ${RENDER}?width=1440&quality=70 1440w`,
  );
  assert.equal(p.sizes, "100vw");
  // Ningún atributo apunta al original.
  assert.ok(!JSON.stringify(p).includes("/object/public/"));
});

test("propsDeFoto con un solo ancho no manda srcset", () => {
  assert.deepEqual(propsDeFoto(ORIGINAL, { anchos: [64] }), { src: `${RENDER}?width=64&quality=70` });
});

test("propsDeFoto deja pasar lo que no es del almacenamiento y lo vacío", () => {
  assert.deepEqual(propsDeFoto("/portada/hero.webp", { sizes: "100vw" }), { src: "/portada/hero.webp" });
  assert.deepEqual(propsDeFoto(null), {});
});
