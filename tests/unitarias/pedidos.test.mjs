import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agregarAlCarrito,
  avisoDeEstado,
  carritoValido,
  catalogoParaPedir,
  codigoDePedido,
  cuentaDe,
  entregaEnTexto,
  filaDePedido,
  interpretarPedido,
  leerMensajeDeLaCarta,
  lineasDelCarrito,
  lineasGuardadas,
  pedidoAbierto,
  platillosDelCatalogo,
  quitarDelCarrito,
  siguientesEstados,
  textoDelPedido,
  ALFABETO_CODIGO,
  MAX_CANTIDAD,
  MAX_LINEAS,
} from "../../lib/pedidos.js";
import { mensajeDePedido } from "../../lib/whatsapp.js";

import { MENUS, NOCHE, MANANA, ZONA } from "./_taqueria.mjs";

const catalogoNoche = catalogoParaPedir(MENUS, ZONA, NOCHE);
const platillos = platillosDelCatalogo(catalogoNoche);

test("el catálogo: solo cartas digitales que se sirven ahora, sin agotados", () => {
  assert.deepEqual(
    catalogoNoche.map((g) => g.nombre),
    ["Tacos", "Gringas", "Bebidas", "Otros platillos"],
  );
  assert.equal(platillos.has("p-agotada"), false);
  assert.equal(platillos.has("p-machacado"), false);

  const manana = catalogoParaPedir(MENUS, ZONA, MANANA);
  // Con dos cartas a la vez, los sueltos se llaman como su carta.
  assert.deepEqual(
    manana.map((g) => g.nombre),
    ["Tacos", "Gringas", "Bebidas", "Carta", "Desayunos"],
  );
  assert.equal(manana[0].carta, "Carta");
  assert.equal(platillosDelCatalogo(manana).get("p-machacado").grupo, "s-desayunos");
});

test("el carrito suma, topa y se limpia", () => {
  const trompo = platillos.get("p-trompo");
  let c = agregarAlCarrito([], trompo, 2);
  c = agregarAlCarrito(c, trompo, 3);
  assert.deepEqual(c, [{ id: "p-trompo", nombre: "Tacos de trompo", cantidad: 5 }]);
  assert.equal(agregarAlCarrito(c, trompo, 999)[0].cantidad, MAX_CANTIDAD);
  assert.deepEqual(agregarAlCarrito(c, trompo, 0), c);
  assert.deepEqual(agregarAlCarrito(c, null, 1), c);
  assert.deepEqual(quitarDelCarrito(c, "p-trompo"), []);

  let lleno = [];
  for (let i = 0; i < MAX_LINEAS + 5; i += 1) lleno = agregarAlCarrito(lleno, { id: `x${i}`, nombre: "x" }, 1);
  assert.equal(lleno.length, MAX_LINEAS);

  assert.deepEqual(carritoValido("nada"), []);
  assert.deepEqual(carritoValido([{ id: "a", cantidad: "7" }, { cantidad: 2 }, null]), [
    { id: "a", nombre: "", cantidad: 7 },
  ]);
});

test("las líneas se leen con el precio de ahora y dicen qué ya no se sirve", () => {
  const { lineas, faltan } = lineasDelCarrito(
    [
      { id: "p-pastor", nombre: "Tacos de pastor", cantidad: 2 },
      { id: "p-machacado", nombre: "Machacado con huevo", cantidad: 1 },
    ],
    platillos,
  );
  assert.deepEqual(lineas, [{ id: "p-pastor", nombre: "Tacos de pastor", cantidad: 2, precio: 2500, moneda: "MXN" }]);
  assert.deepEqual(faltan, ["Machacado con huevo"]);

  assert.deepEqual(cuentaDe(lineas), { piezas: 2, total: 5000, completo: true, alguno: true, moneda: "MXN" });
  assert.equal(textoDelPedido(lineas), "• 2 × Tacos de pastor — $50\nTotal aproximado: $50");

  const conSalsa = [...lineas, { id: "p-sinprecio", nombre: "Salsa extra", cantidad: 1, precio: null, moneda: "MXN" }];
  assert.match(textoDelPedido(conSalsa), /• 1 × Salsa extra\nTotal aproximado: \$50 \(sin lo que no tiene precio\)$/);
  assert.equal(textoDelPedido([{ nombre: "Salsa extra", cantidad: 1, precio: null }]), "• 1 × Salsa extra");
});

test("el mensaje que arma la carta se lee de vuelta", () => {
  const mensaje = mensajeDePedido({
    nombre: "Taquería El Trompo",
    url: "https://menuabierto.com/eltrompo/menu",
    lineas: [
      { nombre: "Tacos de pastor", cantidad: 3, precio: 2500 },
      { nombre: "Agua de horchata", cantidad: 1, precio: 3000 },
      { nombre: "Salsa extra", cantidad: 1, precio: null },
    ],
    entrega: "domicilio",
  });
  const leido = leerMensajeDeLaCarta(mensaje, platillos);
  assert.deepEqual(leido.lineas, [
    { id: "p-pastor", nombre: "Tacos de pastor", cantidad: 3 },
    { id: "p-horchata", nombre: "Agua de horchata", cantidad: 1 },
    { id: "p-sinprecio", nombre: "Salsa extra", cantidad: 1 },
  ]);
  assert.deepEqual(leido.sinEncontrar, []);
  assert.equal(leido.entrega, "domicilio");

  // Un platillo de una carta que ya no se sirve no se inventa.
  const desayuno = leerMensajeDeLaCarta("Mi pedido:\n• 1 × Machacado con huevo — $95", platillos);
  assert.deepEqual(desayuno, { lineas: [], sinEncontrar: [{ nombre: "Machacado con huevo", cantidad: 1 }], entrega: null });

  // Dos platillos con el mismo nombre: decide el precio.
  const dobles = new Map([
    ["a", { id: "a", nombre: "Especial", precio: 10000 }],
    ["b", { id: "b", nombre: "Especial", precio: 15000 }],
  ]);
  assert.equal(leerMensajeDeLaCarta("• 2 × Especial — $300", dobles).lineas[0].id, "b");
  assert.equal(leerMensajeDeLaCarta("• 1 × Especial — $1,000.00", dobles).lineas[0].id, "a");

  // Lo que no trae renglones de pedido no es un mensaje de la carta, ni una
  // lista escrita a mano.
  assert.equal(leerMensajeDeLaCarta("hola, ¿a qué hora abren?", platillos), null);
  assert.equal(leerMensajeDeLaCarta("- 2x tacos de pastor", platillos), null);
});

function ids(r) {
  return r.lineas.map((l) => `${l.cantidad}×${l.id}`);
}

test("un pedido escrito de corrido", () => {
  let r = interpretarPedido("quiero 2 tacos de trompo y una coca light", platillos);
  assert.deepEqual(ids(r), ["2×p-trompo", "1×p-coca-light"]);
  assert.equal(r.conCantidad, true);
  assert.deepEqual(r.dudas, []);

  // Sin repetir "tacos": el segundo trozo se entiende por el primero...
  r = interpretarPedido("2 tacos de trompo y 1 de pastor", platillos);
  assert.deepEqual(ids(r), ["2×p-trompo", "1×p-pastor"]);

  // ...pero solo si el primero lo dijo. Aquí nadie dijo "tacos", y de pastor
  // hay taco y gringa: se pregunta.
  r = interpretarPedido("3 de trompo y 2 de pastor", platillos);
  assert.deepEqual(ids(r), ["3×p-trompo"]);
  assert.equal(r.dudas.length, 1);
  assert.equal(r.dudas[0].cantidad, 2);

  // Faltas de dedo, plurales, acentos y mayúsculas.
  r = interpretarPedido("Me das 4 TACOS DE TRONPO porfa", platillos);
  assert.deepEqual(ids(r), ["4×p-trompo"]);
  r = interpretarPedido("una horchata, dos jamaicas", platillos);
  assert.deepEqual(ids(r), ["1×p-horchata", "2×p-jamaica"]);
  r = interpretarPedido("2x gringa de sirloin", platillos);
  assert.deepEqual(ids(r), ["2×p-gringa-sirloin"]);
  r = interpretarPedido("tacos de bistec x3", platillos);
  assert.deepEqual(ids(r), ["3×p-bistec"]);
  r = interpretarPedido("media docena de tacos de trompo", platillos);
  assert.deepEqual(ids(r), ["6×p-trompo"]);

  // El nombre exacto gana al que lo contiene, y las palabras de más no
  // estorban.
  r = interpretarPedido("2 tacos de pastor bien doraditos", platillos);
  assert.deepEqual(ids(r), ["2×p-pastor"]);
  r = interpretarPedido("un pastel de tres leches", platillos);
  assert.deepEqual(ids(r), ["1×p-pastel"]);

  // Lo ambiguo se pregunta, con los candidatos.
  r = interpretarPedido("2 de pastor", platillos);
  assert.deepEqual(r.lineas, []);
  assert.equal(r.dudas[0].cantidad, 2);
  assert.deepEqual(
    r.dudas[0].candidatos.map((c) => c.id).sort(),
    ["p-gringa-pastor", "p-pastor", "p-pastor-queso"].sort(),
  );
  r = interpretarPedido("una coca", platillos);
  assert.deepEqual(r.dudas[0].candidatos.map((c) => c.id).sort(), ["p-coca", "p-coca-light"]);

  // "papa y chorizo" sin cantidad detrás de la "y" es un solo platillo.
  const conPapa = new Map([["pc", { id: "pc", nombre: "Tacos de papa y chorizo", precio: 2000 }]]);
  assert.deepEqual(ids(interpretarPedido("3 tacos de papa y chorizo", conPapa)), ["3×pc"]);

  // Lo que no está en la carta no se inventa, y un saludo no es un pedido.
  r = interpretarPedido("2 hamburguesas", platillos);
  assert.deepEqual(r.lineas, []);
  assert.deepEqual(r.sinEncontrar, ["hamburguesas"]);
  // Lo que se le repite al cliente conserva sus acentos, sin el "quiero 2" ni
  // el "para llevar".
  assert.deepEqual(interpretarPedido("Quiero 2 Órdenes de Pozole, porfa", platillos).sinEncontrar, [
    "órdenes de pozole",
  ]);
  assert.equal(interpretarPedido("2 de trompo y una coca para llevar porfa", platillos).dudas[0].texto, "coca");
  assert.deepEqual(interpretarPedido("quiero hacer un pedido", platillos).sinEncontrar, []);
  r = interpretarPedido("hola buenas tardes", platillos);
  assert.deepEqual([r.lineas, r.dudas, r.sinEncontrar], [[], [], []]);
  assert.equal(r.conCantidad, false);

  // Un número que es parte del nombre no es la cantidad.
  r = interpretarPedido("coca cola 600", platillos);
  assert.deepEqual(ids(r), ["1×p-coca"]);
  assert.equal(r.conCantidad, false);
});

test("cómo lo quiere, si lo dijo", () => {
  assert.equal(entregaEnTexto("2 de pastor para llevar"), "llevar");
  assert.equal(entregaEnTexto("me lo traen a domicilio?"), "domicilio");
  assert.equal(entregaEnTexto("es para comer aquí"), "sitio");
  assert.equal(entregaEnTexto("2 de pastor"), null);
  assert.equal(interpretarPedido("3 de trompo para llevar", platillos).entrega, "llevar");
});

test("los estados del pedido y lo que se le avisa al cliente", () => {
  assert.deepEqual(siguientesEstados("nuevo"), ["aceptado", "cancelado"]);
  assert.deepEqual(siguientesEstados("listo"), ["entregado", "cancelado"]);
  assert.deepEqual(siguientesEstados("entregado"), []);
  assert.deepEqual(siguientesEstados("constructor"), []);
  assert.equal(pedidoAbierto("aceptado"), true);
  assert.equal(pedidoAbierto("cancelado"), false);

  assert.equal(avisoDeEstado({ status: "aceptado", codigo: "K7M2" }), "Aceptamos tu pedido K7M2. Ya lo estamos preparando.");
  assert.match(avisoDeEstado({ status: "listo", codigo: "K7M2", entrega: "domicilio" }), /va en camino/);
  assert.match(avisoDeEstado({ status: "listo", codigo: "K7M2", entrega: "llevar" }), /pasar por él/);
  assert.match(avisoDeEstado({ status: "cancelado", codigo: "K7M2", telefono: "81 1234 5678" }), /llámanos al 81 1234 5678/);
  assert.equal(avisoDeEstado({ status: "entregado", codigo: "K7M2" }), null);
  // Al entregar se pide la reseña, con el enlace que deja el pase del QR.
  const enlace = `https://menuabierto.com/q/pedido/${"a".repeat(32)}`;
  assert.equal(
    avisoDeEstado({ status: "entregado", codigo: "K7M2", resena: enlace }),
    `¡Gracias por tu pedido K7M2! Si te gustó, tu reseña nos ayuda mucho: ${enlace}`,
  );
  assert.equal(avisoDeEstado({ status: "nuevo", codigo: "K7M2", resena: enlace }), null);
});

test("el código: corto, sin letras que se confunden", () => {
  assert.equal(codigoDePedido(() => 0), "2222");
  assert.equal(codigoDePedido(() => 0.9999999), "ZZZZ");
  assert.equal(codigoDePedido(() => 1), "ZZZZ");
  const codigo = codigoDePedido();
  assert.match(codigo, /^[A-Z0-9]{4}$/);
  assert.doesNotMatch(ALFABETO_CODIGO, /[01OIL]/);
});

test("la fila respeta lo que la base va a comprobar", () => {
  const lineas = [{ id: "p-pastor", nombre: "Tacos de pastor", cantidad: 2, precio: 2500, moneda: "MXN" }];
  const fila = filaDePedido({
    restauranteId: "r1",
    codigo: "K7M2",
    origen: "carta",
    cliente: { nombre: "  Ana  ", telefono: "5218111111111", usuario: "MX.abc" },
    entrega: "domicilio",
    direccion: "Padre Mier 123, Centro",
    ubicacion: { lat: 25.67, lng: -100.31 },
    nota: "sin cebolla",
    lineas,
    clave: "wamid.confirmacion",
  });
  assert.deepEqual(fila, {
    restaurant_id: "r1",
    code: "K7M2",
    origin: "carta",
    customer_name: "Ana",
    customer_phone: "5218111111111",
    customer_user_id: "MX.abc",
    delivery: "domicilio",
    address: "Padre Mier 123, Centro",
    lat: 25.67,
    lng: -100.31,
    notes: "sin cebolla",
    details: null,
    items: [{ menu_item_id: "p-pastor", name: "Tacos de pastor", quantity: 2, price_cents: 2500 }],
    total_cents: 5000,
    currency: "MXN",
    confirmation_key: "wamid.confirmacion",
  });

  const rara = filaDePedido({
    restauranteId: "r1",
    codigo: "AAAA",
    origen: "inventado",
    cliente: { telefono: "no-es-telefono", usuario: "MX.abc" },
    entrega: "dron",
    ubicacion: { lat: 200, lng: 0 },
    libre: "2 órdenes de tacos",
    lineas: [],
  });
  assert.equal(rara.origin, "chat");
  assert.equal(rara.customer_phone, null);
  assert.equal(rara.delivery, null);
  assert.equal(rara.lat, null);
  assert.equal(rara.details, "2 órdenes de tacos");
  assert.equal(rara.total_cents, null);

  assert.deepEqual(lineasGuardadas(fila.items), [{ id: "p-pastor", nombre: "Tacos de pastor", cantidad: 2, precio: 2500 }]);
  assert.deepEqual(lineasGuardadas("x"), []);
});

test("estadísticas: el periodo es 7, 30 o 90 días, y la hora se dice como franja", async () => {
  const { periodoDeEstadisticas, franjaHoraria } = await import("../../lib/pedidos.js");
  assert.equal(periodoDeEstadisticas("7"), 7);
  assert.equal(periodoDeEstadisticas(90), 90);
  assert.equal(periodoDeEstadisticas("15"), 30);
  assert.equal(periodoDeEstadisticas(undefined), 30);
  assert.equal(franjaHoraria(14), "2 pm a 3 pm");
  assert.equal(franjaHoraria(0), "12 am a 1 am");
  assert.equal(franjaHoraria(11), "11 am a 12 pm");
  assert.equal(franjaHoraria(23), "11 pm a 12 am");
  assert.equal(franjaHoraria(24), "");
  assert.equal(franjaHoraria(null), "");
});
