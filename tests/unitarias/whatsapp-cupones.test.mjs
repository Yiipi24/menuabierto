import { test } from "node:test";
import assert from "node:assert/strict";
import { telefonoWhatsapp, telefonoLegible, enlaceWhatsapp, pedidosDe, mensajeDePedido } from "../../lib/whatsapp.js";
import { normalizarCodigo, codigoValido, aValorGuardado, textoDelDescuento, estaVigente, estadoDeCupon, conversion } from "../../lib/cupones.js";

test("el número queda como lo quiere wa.me", () => {
  assert.equal(telefonoWhatsapp("81 1234 5678"), "528112345678");
  assert.equal(telefonoWhatsapp("+52 1 81 1234 5678"), "528112345678");
  assert.equal(telefonoWhatsapp("+1 415 555 0100"), "14155550100");
  assert.equal(telefonoWhatsapp(""), null);
  assert.equal(telefonoWhatsapp("hola"), undefined);
  assert.equal(telefonoWhatsapp("123"), undefined);
  assert.equal(telefonoLegible("528112345678"), "+52 81 1234 5678");
  assert.equal(telefonoLegible("34612345678"), "+34612345678");
});

test("el enlace y el pedido", () => {
  assert.equal(enlaceWhatsapp(null, "x"), null);
  assert.equal(enlaceWhatsapp("528112345678"), "https://wa.me/528112345678");
  assert.ok(enlaceWhatsapp("528112345678", "hola qué tal").endsWith("?text=hola%20qu%C3%A9%20tal"));

  assert.equal(pedidosDe({ whatsapp_orders: true, whatsapp_phone: "" }), null);
  assert.deepEqual(pedidosDe({ whatsapp_orders: true, whatsapp_phone: "8112345678", whatsapp_note: " Mínimo $150 " }), {
    telefono: "528112345678",
    nota: "Mínimo $150",
  });

  const msj = mensajeDePedido({
    nombre: "Tacos",
    url: "https://menuabierto.com/tacos/menu",
    lineas: [
      { nombre: "Pastor", cantidad: 2, precio: 2500 },
      { nombre: "Agua", cantidad: 1, precio: null },
      { nombre: "Nada", cantidad: 0, precio: 100 },
    ],
  });
  assert.match(msj, /• 2 × Pastor — \$50/);
  assert.match(msj, /• 1 × Agua\n/);
  assert.match(msj, /Total aproximado: \$50/);
  assert.doesNotMatch(msj, /Nada/);
});

test("los cupones: código, cifra y vigencia", () => {
  assert.equal(normalizarCodigo(" verano-15 "), "VERANO15");
  assert.equal(codigoValido("ab"), false);
  assert.equal(codigoValido("VERANO15"), true);
  assert.equal(aValorGuardado("porcentaje", "15%"), 15);
  assert.equal(aValorGuardado("porcentaje", "150"), undefined);
  assert.equal(aValorGuardado("monto", "$50"), 5000);
  assert.equal(aValorGuardado("2x1", "7"), null);
  assert.equal(textoDelDescuento({ kind: "monto", value_int: 5000 }), "$50 de descuento");

  const ahora = new Date("2026-09-09T12:00:00Z");
  const vivo = { is_active: true, ends_at: "2026-09-30T00:00:00Z", max_redemptions: 10, redemptions_count: 3 };
  assert.equal(estaVigente(vivo, ahora), true);
  assert.equal(estadoDeCupon({ ...vivo, redemptions_count: 10 }, ahora).slug, "agotado");
  assert.equal(estadoDeCupon({ ...vivo, ends_at: "2026-09-01T00:00:00Z" }, ahora).slug, "vencido");
  assert.equal(estadoDeCupon({ ...vivo, starts_at: "2026-10-01T00:00:00Z" }, ahora).slug, "programado");
  assert.equal(estadoDeCupon({ is_active: false }, ahora).slug, "apagado");
  assert.equal(conversion(0, 0), null);
  assert.equal(conversion(200, 30), 15);
});
