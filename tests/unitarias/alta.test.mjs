import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PASOS_DEL_EMBUDO,
  avanceDeAlta,
  faltanParaPublicar,
  menuConContenido,
  pasoValido,
  pasosDeAlta,
} from "../../lib/alta.js";

const vacia = {
  restaurante: { status: "borrador", street: null },
  coords: null,
  horarios: [],
  fotos: [],
  menus: [],
  platillos: [],
  pasos: ["alta_creada"],
};

const completa = {
  restaurante: { status: "publicado", street: "Padre Mier 456" },
  coords: { lat: 25.67, lng: -100.31 },
  horarios: [{ weekday: 1, opens: "13:00", closes: "22:00" }],
  fotos: [{ is_visible: true }],
  menus: [{ id: "m1", kind: "digital", is_visible: true }],
  platillos: [{ id: "p1", menu_id: "m1" }],
  pasos: ["alta_creada", "menu_creado", "qr_descargado", "ficha_publicada"],
};

const listo = (lista, clave) => lista.find((p) => p.clave === clave).listo;

test("una ficha recién creada tiene todo pendiente y avisa de carta y dirección", () => {
  const lista = pasosDeAlta(vacia);
  assert.deepEqual(
    lista.map((p) => p.clave),
    ["direccion", "horario", "foto", "carta", "qr", "publicar"],
  );
  assert.deepEqual(avanceDeAlta(lista), { listos: 0, total: 6, completa: false });
  assert.deepEqual(faltanParaPublicar(lista), ["Dirección con su punto en el mapa", "Tu carta, con platillos"]);
});

test("una ficha completa y publicada no tiene pendientes", () => {
  const lista = pasosDeAlta(completa);
  assert.deepEqual(avanceDeAlta(lista), { listos: 6, total: 6, completa: true });
  assert.deepEqual(faltanParaPublicar(lista), []);
});

test("cada paso se marca solo con lo que ya hay", () => {
  // La dirección pide calle y punto; con uno solo no basta.
  assert.equal(listo(pasosDeAlta({ ...vacia, restaurante: { street: "Calle 1" } }), "direccion"), false);
  assert.equal(listo(pasosDeAlta({ ...vacia, coords: { lat: 1, lng: 2 } }), "direccion"), false);
  // Una foto oculta no cuenta.
  assert.equal(listo(pasosDeAlta({ ...vacia, fotos: [{ is_visible: false }] }), "foto"), false);
  assert.equal(listo(pasosDeAlta({ ...vacia, fotos: [{ is_visible: true }] }), "foto"), true);
  // El QR se marca con el paso del embudo, no con nada de la ficha.
  assert.equal(listo(pasosDeAlta({ ...vacia, pasos: ["qr_descargado"] }), "qr"), true);
});

test("la carta cuenta si hay un menú visible con platillos o con su archivo", () => {
  assert.equal(menuConContenido({ id: "m1", kind: "digital", is_visible: true }, []), false);
  assert.equal(menuConContenido({ id: "m1", kind: "digital", is_visible: false }, [{ menu_id: "m1" }]), false);
  assert.equal(menuConContenido({ id: "m1", kind: "digital", is_visible: true }, [{ menu_id: "m1" }]), true);
  assert.equal(menuConContenido({ id: "m1", kind: "digital", is_visible: true }, [{ menu_id: "m2" }]), false);
  assert.equal(menuConContenido({ id: "m2", kind: "archivo", is_visible: true, file_path: "r/carta.pdf" }), true);
  assert.equal(menuConContenido({ id: "m2", kind: "archivo", is_visible: true, file_path: null }), false);

  // Con menús pero ninguno con contenido, la ayuda lo dice distinto.
  const conMenuVacio = pasosDeAlta({ ...vacia, menus: [{ id: "m1", kind: "digital", is_visible: true }] });
  assert.match(conMenuVacio.find((p) => p.clave === "carta").ayuda, /ninguno visible/);
});

test("el catálogo del embudo es cerrado", () => {
  assert.deepEqual(PASOS_DEL_EMBUDO, ["alta_creada", "menu_creado", "qr_descargado", "ficha_publicada"]);
  assert.equal(pasoValido("qr_descargado"), true);
  assert.equal(pasoValido("cualquier_cosa"), false);
});
