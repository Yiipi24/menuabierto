import { test } from "node:test";
import assert from "node:assert/strict";
import { menuPublicable, platillosDeFila } from "../../lib/menus-publicos.js";

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
