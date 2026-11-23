import { test } from "node:test";
import assert from "node:assert/strict";
import { responder } from "../../lib/asistente.js";
import { avisoDeEstado } from "../../lib/pedidos.js";
import { NOCHE, ficha, pedidosDe } from "./_taqueria.mjs";

// La taquería con reglas de envío (#97): $30 hasta 3 km y $50 hasta 6 km,
// mínimo de $150 a domicilio, gratis desde $400 y 20 minutos para llevar.
const conEnvio = () =>
  ficha({
    pedidos: pedidosDe({
      whatsapp_orders: true,
      whatsapp_phone: "528112345678",
      service_mode: "ambos",
      amenities: ["domicilio"],
      delivery_zones: [
        { max_km: 3, fee_cents: 3000, minutes: 35 },
        { max_km: 6, fee_cents: 5000, minutes: 50 },
      ],
      delivery_min_cents: 15000,
      delivery_free_from_cents: 40000,
      pickup_minutes: 20,
    }),
  });

function conversar(f, turnos) {
  let estado = {};
  return turnos.map((entrada) => {
    const r = responder({
      ficha: f,
      chat: { estado, nombre: "Ana" },
      entrada: typeof entrada === "string" ? { tipo: "texto", texto: entrada } : entrada,
      ahora: NOCHE,
    });
    estado = r.estado;
    return r;
  });
}

const op = (opcion) => ({ tipo: "opcion", opcion });
const aqui = (distanciaM) => ({ tipo: "ubicacion", ubicacion: { lat: 25.67, lng: -100.31, distanciaM } });
const ids = (m) => m.botones.map((b) => b.id);
// Dos gringas de sirloin: $150, justo el mínimo.
const dosGringas = [op("o:pedir"), op("g:s-gringas"), op("p:p-gringa-sirloin"), op("c:2"), op("k:terminar")];

test("por debajo del mínimo no se pide la dirección: se dice cuánto falta", () => {
  const [, , , , , minimo, llevar] = conversar(conEnvio(), [
    op("o:pedir"),
    op("g:s-tacos"),
    op("p:p-pastor"),
    op("c:3"),
    op("k:terminar"),
    op("e:domicilio"),
    op("e:llevar"),
  ]);
  assert.match(minimo.mensajes[0].texto, /^El pedido mínimo a domicilio es de \$150: te faltan \$75\.$/);
  assert.deepEqual(ids(minimo.mensajes[0]), ["k:agregar", "e:llevar", "f:cancelar"]);
  assert.equal(minimo.estado.paso, "carrito");
  // Para llevar no hay mínimo, y sale con su tiempo.
  assert.equal(llevar.estado.paso, "confirmar");
  assert.match(llevar.mensajes[0].texto, /Estará listo en unos 20 minutos desde que lo aceptemos\./);
});

test("con la ubicación, el envío de su zona, el total con envío y el tiempo", () => {
  const turnos = conversar(conEnvio(), [...dosGringas, op("e:domicilio"), aqui(2430), op("f:confirmar")]);
  const [direccion, resumen, fin] = turnos.slice(-3);

  assert.match(direccion.mensajes[0].texto, /Comparte tu ubicación desde el clip/);
  assert.match(direccion.mensajes[0].texto, /Envío: \$30 hasta 3 km y \$50 hasta 6 km\. Gratis desde \$400\. Pedido mínimo a domicilio: \$150\./);
  assert.match(
    resumen.mensajes[0].texto,
    /• 2 × Gringa de sirloin — \$150\nEnvío: \$30 \(2\.4 km\)\nTotal aproximado: \$180\n/,
  );
  assert.match(resumen.mensajes[0].texto, /Llega en unos 35 minutos desde que lo aceptemos\./);
  assert.doesNotMatch(resumen.mensajes[0].texto, /te decimos el envío exacto/);

  assert.equal(fin.pedido.envio, 3000);
  assert.equal(fin.pedido.minutos, 35);
  assert.equal(fin.pedido.distancia, 2430);
});

test("fuera de la última zona: lo dice, y ofrece llevar u otra ubicación", () => {
  const turnos = conversar(conEnvio(), [
    ...dosGringas,
    op("e:domicilio"),
    aqui(7200),
    op("d:otra"),
    "Calle Hidalgo 300, Col. Obispado",
    aqui(1000),
  ]);
  const [fuera, otra, escrita, exacta] = turnos.slice(-4);

  assert.match(fuera.mensajes[0].texto, /^Tu ubicación está a 7\.2 km, y llevamos hasta 6 km\.$/);
  assert.deepEqual(ids(fuera.mensajes[0]), ["e:llevar", "d:otra", "f:cancelar"]);
  assert.equal(fuera.pedido, undefined);

  assert.equal(otra.estado.paso, "direccion");
  assert.equal(otra.estado.distancia, null);

  // Con la dirección escrita no hay distancia: la zona más cara, dicha como
  // estimado, y la invitación a mandar la ubicación.
  assert.match(escrita.mensajes[0].texto, /Envío: \$50\. Lo confirmamos con tu dirección\.\nTotal aproximado: \$200/);
  assert.match(escrita.mensajes[0].texto, /Si nos compartes tu ubicación desde el clip, te decimos el envío exacto\./);

  // La ubicación mandada en el resumen lo vuelve exacto, sin perder la dirección.
  assert.equal(exacta.estado.paso, "confirmar");
  assert.equal(exacta.estado.direccion, "Calle Hidalgo 300, Col. Obispado");
  assert.match(exacta.mensajes[0].texto, /Envío: \$30 \(1 km\)\nTotal aproximado: \$180/);
});

test("desde el monto de envío gratis, el envío es gratis", () => {
  const turnos = conversar(conEnvio(), [
    op("o:pedir"),
    op("g:s-gringas"),
    op("p:p-gringa-sirloin"),
    "6",
    op("k:terminar"),
    op("e:domicilio"),
    aqui(5000),
    op("f:confirmar"),
  ]);
  const [resumen, fin] = turnos.slice(-2);
  assert.match(resumen.mensajes[0].texto, /Envío: gratis \(tu pedido pasa de \$400\)\nTotal aproximado: \$450/);
  assert.match(resumen.mensajes[0].texto, /Llega en unos 50 minutos/);
  assert.equal(fin.pedido.envio, 0);
});

test("el mínimo se vuelve a revisar al confirmar", () => {
  // El resumen se armó sin mínimo; entretanto el dueño puso uno de $200.
  const sinMinimo = ficha({
    pedidos: pedidosDe({
      whatsapp_orders: true,
      whatsapp_phone: "528112345678",
      service_mode: "ambos",
      amenities: ["domicilio"],
      delivery_zones: [{ max_km: null, fee_cents: 4000 }],
    }),
  });
  const [resumen] = conversar(sinMinimo, [...dosGringas, op("e:domicilio"), "Padre Mier 456, Centro"]).slice(-1);
  assert.match(resumen.mensajes[0].texto, /Envío: \$40\nTotal aproximado: \$190/);

  const conMinimo = { ...sinMinimo, pedidos: { ...sinMinimo.pedidos, envio: { ...sinMinimo.pedidos.envio, minimo: 20000 } } };
  const r = responder({ ficha: conMinimo, chat: { estado: resumen.estado }, entrada: op("f:confirmar"), ahora: NOCHE });
  assert.equal(r.pedido, undefined);
  assert.match(r.mensajes[0].texto, /te faltan \$50/);
});

test("\"¿tienen servicio a domicilio?\" contesta con las reglas", () => {
  const [r] = conversar(conEnvio(), ["¿tienen servicio a domicilio?"]);
  assert.match(
    r.mensajes[0].texto,
    /Sí, tenemos servicio a domicilio\. Envío: \$30 hasta 3 km y \$50 hasta 6 km\. Gratis desde \$400\. Pedido mínimo a domicilio: \$150\./,
  );
});

test("al aceptar, el aviso dice el tiempo que se prometió", () => {
  assert.equal(
    avisoDeEstado({ status: "aceptado", codigo: "K7M2", entrega: "domicilio", minutos: 35 }),
    "Aceptamos tu pedido K7M2. Ya lo estamos preparando: llega en unos 35 minutos.",
  );
  assert.equal(
    avisoDeEstado({ status: "aceptado", codigo: "K7M2", entrega: "llevar", minutos: 20 }),
    "Aceptamos tu pedido K7M2. Ya lo estamos preparando: estará listo en unos 20 minutos.",
  );
  assert.equal(
    avisoDeEstado({ status: "aceptado", codigo: "K7M2", entrega: "domicilio" }),
    "Aceptamos tu pedido K7M2. Ya lo estamos preparando.",
  );
});
