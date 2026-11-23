import { test } from "node:test";
import assert from "node:assert/strict";
import { leyendaDePrecios, menuPublicable, platillosDeFila } from "../../lib/menus-publicos.js";

test("un menú de archivo se anuncia solo con su archivo", () => {
  assert.equal(menuPublicable({ kind: "archivo", file_path: "r/carta.pdf", platillos: 0 }), true);
  // El caso que encontró la auditoría: "Test subir", de archivo y sin archivo.
  assert.equal(menuPublicable({ kind: "archivo", file_path: null, platillos: 0 }), false);
});

test("un menú digital se anuncia solo con platillos", () => {
  assert.equal(menuPublicable({ kind: "digital", file_path: null, platillos: 7 }), true);
  assert.equal(menuPublicable({ kind: "digital", file_path: null, platillos: 0 }), false);
});

test("el conteo sale de la fila con menu_items(count)", () => {
  assert.equal(platillosDeFila({ menu_items: [{ count: 7 }] }), 7);
  assert.equal(platillosDeFila({ menu_items: [] }), 0);
  assert.equal(platillosDeFila({}), 0);
});

const carta = (items, extra = {}) => ({ kind: "digital", grupos: [{ id: "g1", items }], ...extra });

test("la carta con precios dice que son pesos y con IVA", () => {
  assert.equal(
    leyendaDePrecios([carta([{ price_cents: 14500, currency: "MXN" }, { price_cents: null }])]),
    "Precios en pesos mexicanos (MXN), con IVA incluido, como los publica el restaurante.",
  );
  // Sin moneda guardada cuenta como la de la base: MXN.
  assert.match(leyendaDePrecios([carta([{ price_cents: 9900 }])]), /pesos mexicanos \(MXN\)/);
});

test("sin precios que aclarar, no hay leyenda", () => {
  assert.equal(leyendaDePrecios([]), null);
  assert.equal(leyendaDePrecios([carta([{ price_cents: null }])]), null);
  // Una carta de archivo trae sus precios dentro del PDF.
  assert.equal(leyendaDePrecios([{ kind: "archivo", fileUrl: "x.pdf" }]), null);
});

test("dos monedas se nombran las dos", () => {
  const leyenda = leyendaDePrecios([carta([{ price_cents: 100, currency: "usd" }]), carta([{ price_cents: 100, currency: "MXN" }])]);
  assert.equal(leyenda, "Precios en pesos mexicanos (MXN) y dólares estadounidenses (USD), con IVA incluido, como los publica el restaurante.");
});
