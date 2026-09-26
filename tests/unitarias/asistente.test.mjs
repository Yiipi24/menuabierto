import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confirmacionDePedido,
  estadoVigente,
  intencionesDe,
  lineaDeAhora,
  nombreDePila,
  responder,
  textoDeSemana,
  PAUSA_MINUTOS,
} from "../../lib/asistente.js";
import { mensajeDePedido } from "../../lib/whatsapp.js";
import { HORARIOS, MANANA, NOCHE, ficha } from "./_taqueria.mjs";

// Una conversación: cada turno recibe el estado que dejó el anterior, como lo
// haría el webhook al leerlo de `whatsapp_chats`.
function conversar(f, turnos, { ahora = NOCHE, nombre = "ANA MARÍA", nuevo = false } = {}) {
  let estado = {};
  let pausadoHasta = null;
  return turnos.map((entrada, i) => {
    const r = responder({
      ficha: f,
      chat: { estado, nombre, pausadoHasta, nuevo: nuevo && i === 0 },
      entrada: typeof entrada === "string" ? { tipo: "texto", texto: entrada } : entrada,
      ahora,
    });
    estado = r.estado;
    if (r.pausar) pausadoHasta = new Date(ahora.getTime() + r.pausar * 60000).toISOString();
    return r;
  });
}

const op = (opcion) => ({ tipo: "opcion", opcion });
const filas = (m) => m.secciones.flatMap((s) => s.filas);
const ids = (m) => (m.tipo === "lista" ? filas(m) : m.botones).map((x) => x.id);

test("la semana se dice corta, y el ahora en la hora del local", () => {
  assert.equal(textoDeSemana(HORARIOS, [0]), "Lunes a sábado: 1 pm a 11 pm\nDomingo: Cerrado");
  assert.equal(
    textoDeSemana(
      [
        { weekday: 1, opens: "08:00", closes: "12:00" },
        { weekday: 1, opens: "13:00", closes: "22:00" },
        { weekday: 2, opens: "08:00", closes: "12:00" },
        { weekday: 2, opens: "13:00", closes: "22:00" },
        { weekday: 4, opens: "13:00", closes: "01:30" },
        { weekday: 6, opens: "13:00", closes: "01:30" },
      ],
      [],
    ),
    // El miércoles no tiene horario ni marca: no sale, y corta la racha.
    "Lunes y martes: 8 am a 12 pm y 1 pm a 10 pm\nJueves: 1 pm a 1:30 am\nSábado: 1 pm a 1:30 am",
  );
  assert.equal(textoDeSemana([], []), null);

  const f = ficha();
  assert.equal(lineaDeAhora(f, NOCHE), "Ahorita estamos abiertos, hasta las 11 pm.");
  assert.equal(lineaDeAhora({ ...f, abierto: false }, MANANA), "Ahorita estamos cerrados. Abrimos hoy a la 1 pm.");
  // Sábado 3 de octubre, 11:30 pm: el domingo cierra, así que abre el lunes.
  const sabadoNoche = new Date("2026-10-04T05:30:00Z");
  assert.equal(lineaDeAhora({ ...f, abierto: false }, sabadoNoche), "Ahorita estamos cerrados. Abrimos el lunes a la 1 pm.");
  assert.equal(lineaDeAhora({ ...f, horarios: [] }, NOCHE), null);
});

test("el saludo usa el nombre de pila cuando parece un nombre", () => {
  assert.equal(nombreDePila("ANA MARÍA GARZA"), "Ana");
  assert.equal(nombreDePila("Ing. Carlos Treviño"), "Carlos");
  assert.equal(nombreDePila("🌸"), null);
  assert.equal(nombreDePila("24/7 Ventas"), null);
  assert.equal(nombreDePila(null), null);

  const [r] = conversar(ficha(), ["hola"]);
  const m = r.mensajes[0];
  assert.equal(r.mensajes.length, 1);
  assert.equal(m.tipo, "lista");
  assert.match(m.texto, /^¡Hola, Ana! Soy el asistente de Taquería El Trompo\. Ahorita estamos abiertos, hasta las 11 pm\./);
  assert.deepEqual(ids(m), ["o:carta", "o:pedir", "o:horario", "o:ubicacion", "o:web", "o:pagos", "o:persona"]);
});

test("qué quiere, sin confundir preguntar con pedir", () => {
  assert.deepEqual([...intencionesDe("¿A qué hora abren?")], ["horario"]);
  assert.ok(intencionesDe("me pasas el menú porfa").has("carta"));
  assert.ok(intencionesDe("quiero 2 de pastor").has("pedir"));
  assert.equal(intencionesDe("quiero saber a qué hora cierran").has("pedir"), false);
  assert.ok(intencionesDe("quiero hablar con una persona").has("persona"));
  assert.ok(intencionesDe("tienen servicio a domicilio?").has("domicilio"));
});

test("horario, página, ubicación y pagos contestan de la ficha, en un solo mensaje", () => {
  const [horario] = conversar(ficha(), ["¿A qué hora cierran?"]);
  assert.equal(horario.mensajes.length, 1);
  assert.equal(horario.mensajes[0].tipo, "botones");
  assert.equal(
    horario.mensajes[0].texto,
    "Nuestro horario:\nLunes a sábado: 1 pm a 11 pm\nDomingo: Cerrado\n\nAhorita estamos abiertos, hasta las 11 pm.",
  );
  assert.deepEqual(ids(horario.mensajes[0]), ["o:pedir", "o:carta", "o:opciones"]);

  const [web] = conversar(ficha(), ["¿tienen página web?"]);
  assert.match(web.mensajes[0].texto, /Nuestra página: https:\/\/eltrompo\.mx/);
  assert.match(web.mensajes[0].texto, /Menú Abierto, con el menú, fotos y reseñas: https:\/\/menuabierto\.com\/eltrompo/);
  assert.match(web.mensajes[0].texto, /Instagram: https:\/\/instagram\.com\/eltrompo/);

  // Dos preguntas, dos respuestas, un mensaje.
  const [doble] = conversar(ficha(), ["a qué hora cierran y dónde están?"]);
  assert.equal(doble.mensajes.length, 1);
  assert.match(doble.mensajes[0].texto, /Nuestro horario:/);
  assert.match(doble.mensajes[0].texto, /Estamos en Padre Mier 123, Centro, Monterrey\.\nCómo llegar: https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);

  const [pagos] = conversar(ficha(), ["aceptan tarjeta?"]);
  assert.match(pagos.mensajes[0].texto, /Aceptamos: Efectivo, Tarjeta de crédito y Transferencia\./);

  const [domicilio] = conversar(ficha(), ["¿tienen servicio a domicilio?"]);
  assert.match(domicilio.mensajes[0].texto, /Sí, tenemos servicio a domicilio\. Pedido mínimo \$150 a domicilio\./);

  const [sinHorario] = conversar(ficha({ horarios: [], cerrados: [] }), ["a qué hora abren"]);
  assert.match(sinHorario.mensajes[0].texto, /Todavía no tenemos el horario publicado\. Para confirmar, llámanos al 81 8000 1234\./);
});

test("el menú: el enlace de la carta y el PDF tal cual", () => {
  const [r] = conversar(ficha(), ["me pasas el menú?"]);
  assert.equal(r.mensajes.length, 2);
  assert.deepEqual(r.mensajes[0], {
    tipo: "documento",
    url: "https://x.supabase.co/storage/v1/object/public/menus/bebidas.pdf",
    nombre: "Taquería El Trompo - Bebidas en PDF.pdf",
    texto: "Bebidas en PDF",
  });
  assert.match(r.mensajes[1].texto, /Aquí está nuestro menú: https:\/\/menuabierto\.com\/eltrompo\/menu\nDesde ahí puedes armar tu pedido/);
  assert.deepEqual(ids(r.mensajes[1]), ["o:pedir", "o:opciones"]);

  // Solo PDF: un mensaje, con la invitación en el pie del archivo.
  const soloPdf = ficha({ menus: [ficha().menus[2]] });
  const [pdf] = conversar(soloPdf, [op("o:carta")]);
  assert.equal(pdf.mensajes.length, 1);
  assert.equal(pdf.mensajes[0].tipo, "documento");
  assert.equal(pdf.mensajes[0].texto, "Nuestro menú. Para pedir, escríbeme lo que quieres.");
});

test("preguntar por un platillo da su precio, también si ahorita no se sirve", () => {
  const [r] = conversar(ficha(), ["¿cuánto cuestan los tacos de trompo?"]);
  assert.match(r.mensajes[0].texto, /^Sí, tenemos:\nTacos de trompo — \$25$/m);
  assert.equal(r.estado.paso, null, "preguntar no empieza un pedido");

  const [desayuno] = conversar(ficha(), ["tienen machacado?"]);
  assert.match(desayuno.mensajes[0].texto, /Machacado con huevo — \$95 \(ahorita no se sirve\)/);
});

test("un pedido completo con las listas, a domicilio y con nota", () => {
  const turnos = conversar(ficha(), [
    op("o:pedir"),
    op("g:s-tacos"),
    op("p:p-pastor"),
    op("c:3"),
    op("k:agregar"),
    op("g:s-bebidas"),
    op("p:p-horchata"),
    "dos",
    op("k:terminar"),
    op("e:domicilio"),
    "Padre Mier 456, Col. Centro",
    "sin cebolla porfa",
    op("f:confirmar"),
  ]);
  const [secciones, tacos, cantidad, carrito, , , , carrito2, entrega, direccion, confirmar, conNota, fin] = turnos;

  assert.equal(secciones.mensajes[0].tipo, "lista");
  assert.deepEqual(ids(secciones.mensajes[0]), ["g:s-tacos", "g:s-gringas", "g:s-bebidas", "g:m1-sueltos"]);
  assert.deepEqual(ids(tacos.mensajes[0]), ["p:p-trompo", "p:p-pastor", "p:p-bistec", "p:p-pastor-queso", "g+:0"]);
  // El nombre largo va completo en la descripción.
  assert.match(filas(tacos.mensajes[0])[3].descripcion, /^Tacos de pastor con queso · \$32$/);
  assert.match(cantidad.mensajes[0].texto, /^Tacos de pastor \(\$25 c\/u\)\.\n¿Cuántos quieres\?/);
  assert.deepEqual(ids(cantidad.mensajes[0]), ["c:1", "c:2", "c:3"]);
  assert.match(carrito.mensajes[0].texto, /^Agregué 3 × Tacos de pastor\.\n\nTu pedido:\n• 3 × Tacos de pastor — \$75\nTotal aproximado: \$75$/);
  assert.match(carrito2.mensajes[0].texto, /• 2 × Agua de horchata — \$60\nTotal aproximado: \$135/);
  assert.deepEqual(ids(entrega.mensajes[0]), ["e:sitio", "e:llevar", "e:domicilio"]);
  assert.match(direccion.mensajes[0].texto, /¿A dónde te lo llevamos\?[\s\S]*Pedido mínimo \$150 a domicilio\./);
  assert.match(confirmar.mensajes[0].texto, /Revisa tu pedido para Taquería El Trompo:\n• 3 × Tacos de pastor — \$75\n• 2 × Agua de horchata — \$60\nTotal aproximado: \$135\nA domicilio · a nombre de ANA MARÍA\nEntrega en: Padre Mier 456, Col\. Centro/);
  assert.deepEqual(ids(confirmar.mensajes[0]), ["f:confirmar", "f:cambiar", "f:cancelar"]);
  assert.match(conNota.mensajes[0].texto, /^Agregué la nota\.[\s\S]*Nota: sin cebolla porfa/);

  assert.deepEqual(fin.mensajes, []);
  assert.deepEqual(fin.pedido, {
    origen: "chat",
    lineas: [
      { id: "p-pastor", nombre: "Tacos de pastor", cantidad: 3, precio: 2500, moneda: "MXN" },
      { id: "p-horchata", nombre: "Agua de horchata", cantidad: 2, precio: 3000, moneda: "MXN" },
    ],
    libre: null,
    entrega: "domicilio",
    direccion: "Padre Mier 456, Col. Centro",
    ubicacion: null,
    nota: "sin cebolla porfa",
    clave: null,
  });
  // El chat queda limpio; si guardar falla, vuelve a la confirmación.
  assert.equal(fin.estado.paso, null);
  assert.deepEqual(fin.estado.carrito, []);
  assert.equal(fin.estadoSiFalla.paso, "confirmar");

  const [ok] = confirmacionDePedido(ficha(), { codigo: "K7M2", cliente: "ANA MARÍA" });
  assert.equal(
    ok.texto,
    "¡Listo, Ana! Recibimos tu pedido. Tu número de pedido es K7M2.\nTe avisamos por aquí en cuanto lo aceptemos.\nSi necesitas algo más, llámanos al 81 8000 1234.",
  );
});

test("un pedido escrito de corrido, con una pregunta de cuál", () => {
  const [pedido, eleccion, fin] = conversar(ficha(), [
    "quiero 2 tacos de trompo y una coca para llevar",
    op("a:p-coca-light"),
    op("k:terminar"),
  ]);
  assert.equal(pedido.mensajes[0].tipo, "lista");
  assert.match(pedido.mensajes[0].texto, /¿Cuál de estos querías por "coca"\? \(1\)/);
  assert.deepEqual(ids(pedido.mensajes[0]), ["a:p-coca", "a:p-coca-light", "a:ninguno"], "en el orden de la carta");
  assert.match(eleccion.mensajes[0].texto, /Agregué 1 × Coca-Cola light\.[\s\S]*• 2 × Tacos de trompo — \$50\n• 1 × Coca-Cola light — \$35/);
  // "para llevar" ya lo dijo: no se vuelve a preguntar.
  assert.match(fin.mensajes[0].texto, /Revisa tu pedido[\s\S]*Para llevar · a nombre de ANA MARÍA/);
  assert.equal(fin.estado.origen, "texto");

  const [nada] = conversar(ficha(), ["quiero 2 hamburguesas"]);
  assert.match(nada.mensajes[0].texto, /^No encontré en el menú: "hamburguesas"\./);
  assert.equal(nada.estado.paso, "seccion");
});

test("el mensaje de la carta de la ficha va directo a la confirmación", () => {
  const mensaje = mensajeDePedido({
    nombre: "Taquería El Trompo",
    url: "https://menuabierto.com/eltrompo/menu",
    lineas: [
      { nombre: "Tacos de bistec", cantidad: 4, precio: 3000 },
      { nombre: "Machacado con huevo", cantidad: 1, precio: 9500 },
    ],
    entrega: "llevar",
  });
  const [r, fin] = conversar(ficha(), [mensaje, "sí"]);
  assert.match(
    r.mensajes[0].texto,
    /^Recibí tu pedido de la carta\.\n\nEsto no lo encontré en el menú de ahorita: Machacado con huevo\.\n\nRevisa tu pedido[\s\S]*• 4 × Tacos de bistec — \$120\nTotal aproximado: \$120\nPara llevar/,
  );
  assert.equal(fin.pedido.origen, "carta");
  assert.equal(fin.pedido.entrega, "llevar");
  assert.deepEqual(fin.pedido.lineas.map((l) => l.id), ["p-bistec"]);
});

test("cerrado, sin pedidos o sin carta digital", () => {
  const cerrado = ficha({ abierto: false });
  const [r] = conversar(cerrado, [op("o:pedir")], { ahora: MANANA });
  assert.match(r.mensajes[0].texto, /^Ahorita estamos cerrados\. Abrimos hoy a la 1 pm\. Por eso no podemos tomar tu pedido ahorita\./);
  assert.equal(r.estado.paso, null);
  assert.deepEqual(ids(r.mensajes[0]), ["o:carta", "o:opciones"]);

  const [sin] = conversar(ficha({ pedidos: null }), ["quiero 2 tacos de pastor"]);
  assert.match(sin.mensajes[0].texto, /^Por ahora no tomamos pedidos por WhatsApp\. El menú está aquí: https:\/\/menuabierto\.com\/eltrompo\/menu\nSi quieres pedir, llámanos al 81 8000 1234\./);

  // Solo PDF: el pedido se escribe de corrido y se guarda como texto.
  const soloPdf = ficha({ menus: [ficha().menus[2]] });
  const [libre, entrega, fin] = conversar(soloPdf, [op("o:pedir"), "2 órdenes de trompo y una horchata", op("e:llevar"), op("f:confirmar")]);
  assert.match(libre.mensajes[0].texto, /^Escríbeme tu pedido en un mensaje/);
  assert.deepEqual(ids(entrega.mensajes[0]), ["e:sitio", "e:llevar", "e:domicilio"]);
  assert.equal(fin.pedido, undefined, "el tercer turno solo eligió la entrega");
  const [, , confirmacion, guardado] = conversar(soloPdf, [
    op("o:pedir"),
    "2 órdenes de trompo y una horchata",
    op("e:llevar"),
    op("f:confirmar"),
  ]);
  assert.match(confirmacion.mensajes[0].texto, /"2 órdenes de trompo y una horchata"/);
  assert.deepEqual(guardado.pedido.lineas, []);
  assert.equal(guardado.pedido.libre, "2 órdenes de trompo y una horchata");
  assert.equal(guardado.pedido.origen, "texto");
});

test("hablar con alguien: se calla solo si alguien contesta en la app", () => {
  const conApp = ficha({ atiendeEnApp: true });
  const [pide, despues] = conversar(conApp, ["quiero hablar con una persona", "hola?"]);
  assert.equal(pide.pausar, PAUSA_MINUTOS);
  assert.match(pide.mensajes[0].texto, /ya le avisé al equipo de Taquería El Trompo/);
  assert.deepEqual(despues.mensajes, [], "mientras dura la pausa no contesta");

  const [sinApp] = conversar(ficha(), [op("o:persona")]);
  assert.equal(sinApp.pausar, undefined);
  assert.match(sinApp.mensajes[0].texto, /llámanos al 81 8000 1234/);

  const [reserva] = conversar(ficha(), ["quiero reservar una mesa para 6"]);
  assert.match(reserva.mensajes[0].texto, /^Para reservar mesa: Para hablar con alguien/);
});

test("botones viejos, estado caducado y ubicación compartida", () => {
  // Un "Confirmar" tocado después de mandar el pedido.
  const r = responder({
    ficha: ficha(),
    chat: { estado: { ultimoPedido: { codigo: "K7M2", en: NOCHE.toISOString() }, actualizado: NOCHE.toISOString() } },
    entrada: op("f:confirmar"),
    ahora: NOCHE,
  });
  assert.match(r.mensajes[0].texto, /^Tu pedido K7M2 ya lo recibimos\./);
  assert.equal(r.pedido, undefined);

  // Cuatro horas después, el carrito ya no existe.
  const viejo = { paso: "carrito", carrito: [{ id: "p-pastor", nombre: "Tacos de pastor", cantidad: 2 }], actualizado: NOCHE.toISOString() };
  assert.deepEqual(estadoVigente(viejo, new Date(NOCHE.getTime() + 4 * 3600 * 1000)).carrito, []);
  assert.equal(estadoVigente(viejo, NOCHE).carrito.length, 1);
  assert.equal(estadoVigente({ paso: "inventado", actualizado: NOCHE.toISOString() }, NOCHE).paso, null);

  // La ubicación como dirección de entrega.
  const [, , , , fin] = conversar(ficha(), [
    op("o:pedir"),
    op("p:p-bistec"),
    op("c:1"),
    op("k:terminar"),
    op("e:domicilio"),
  ]);
  assert.equal(fin.estado.paso, "direccion");
  const conPunto = responder({
    ficha: ficha(),
    chat: { estado: fin.estado },
    entrada: { tipo: "ubicacion", ubicacion: { lat: 25.67, lng: -100.31, nombre: "Casa", direccion: "Calle 5 de Mayo 800" } },
    ahora: NOCHE,
  });
  assert.equal(conPunto.estado.paso, "confirmar");
  assert.deepEqual(conPunto.estado.ubicacion, { lat: 25.67, lng: -100.31 });
  assert.match(conPunto.mensajes[0].texto, /Entrega en: Casa, Calle 5 de Mayo 800/);
});

test("quitar, vaciar, cancelar, y lo que no se entiende", () => {
  const [, , , quitar, quitado, vaciar] = conversar(ficha(), [
    "2 tacos de trompo, 1 gringa de sirloin",
    op("k:quitar"),
    op("q:p-trompo"),
    op("k:quitar"),
    op("q:p-gringa-sirloin"),
    op("q:*"),
  ]);
  assert.deepEqual(ids(quitar.mensajes[0]), ["q:p-gringa-sirloin", "q:*"]);
  assert.match(quitado.mensajes[0].texto, /Tu pedido está vacío/);
  assert.equal(vaciar.estado.carrito.length, 0);

  const [, cancelado] = conversar(ficha(), ["quiero 3 tacos de pastor", "cancelar"]);
  assert.match(cancelado.mensajes[0].texto, /^Listo, cancelé el pedido\./);
  assert.deepEqual(cancelado.estado.carrito, []);

  const [raro] = conversar(ficha(), ["asdfgh"]);
  assert.match(raro.mensajes[0].texto, /^Perdón, no te entendí\. Elige una opción, o escríbeme por ejemplo: "¿a qué hora abren\?" o "quiero 2 tacos de trompo"\./);

  const [audio] = conversar(ficha(), [{ tipo: "medio" }]);
  assert.match(audio.mensajes[0].texto, /^Por ahora solo leo mensajes de texto/);

  const [gracias] = conversar(ficha(), ["muchas gracias!"]);
  assert.equal(gracias.mensajes[0].texto, "¡Con gusto! Aquí estamos.");
});

test("a la pregunta de cuántos solo contesta un número; la cortesía no es nota", () => {
  const [, , porfa] = conversar(ficha(), [op("o:pedir"), op("p:p-pastor"), "2 porfa"]);
  assert.match(porfa.mensajes[0].texto, /Agregué 2 × Tacos de pastor/);

  // Escribir otro platillo en vez del número no le suma nada al pendiente.
  const [, , otro] = conversar(ficha(), [op("o:pedir"), op("p:p-pastor"), "2 de trompo"]);
  assert.deepEqual(otro.estado.carrito, [{ id: "p-trompo", nombre: "Tacos de trompo", cantidad: 2 }]);

  const [, , , gracias] = conversar(ficha(), [op("o:pedir"), op("p:p-bistec"), op("c:1"), "gracias"]);
  assert.match(gracias.mensajes[0].texto, /^¡Con gusto!\n\nTu pedido:/);

  const turnos = conversar(ficha(), [op("o:pedir"), op("p:p-bistec"), op("c:1"), op("k:terminar"), op("e:llevar"), "gracias"]);
  const fin = turnos.at(-1);
  assert.equal(fin.estado.paso, "confirmar");
  assert.equal(fin.estado.nota, null);
  assert.doesNotMatch(fin.mensajes[0].texto, /Nota:/);
});

test("la confirmación: sí dicho de muchas formas, notas, y cambios a última hora", () => {
  const hastaConfirmar = [op("o:pedir"), op("p:p-pastor"), op("c:2"), op("k:terminar"), op("e:llevar")];
  const final = (turno) => conversar(ficha(), [...hastaConfirmar, turno]).at(-1);

  for (const si of ["Sí, confirmo", "si por favor", "Confirmar pedido", "ok gracias", "está bien"]) {
    assert.ok(final(si).pedido, `«${si}» confirma`);
  }
  for (const no of ["no gracias", "ya no", "mejor no"]) {
    assert.equal(final(no).estado.carrito.length, 0, `«${no}» cancela`);
  }

  const conPero = final("si pero sin cebolla");
  assert.equal(conPero.pedido, undefined);
  assert.equal(conPero.estado.nota, "si pero sin cebolla");

  // Nombrar un platillo en la confirmación es una nota...
  const nota = final("sin cebolla en los de pastor");
  assert.equal(nota.estado.nota, "sin cebolla en los de pastor");
  assert.deepEqual(nota.estado.carrito.map((l) => l.cantidad), [2]);
  // ...salvo que traiga cantidad: entonces se suma.
  const mas = final("agrégale 2 tacos de trompo");
  assert.deepEqual(mas.estado.carrito.map((l) => l.id), ["p-pastor", "p-trompo"]);
  assert.equal(mas.estado.nota, null);

  // Un pedido nuevo desde la carta reemplaza al que estaba por confirmar.
  const carta = final("Mi pedido:\n• 3 × Tacos de trompo — $75\nPara llevar");
  assert.deepEqual(carta.estado.carrito, [{ id: "p-trompo", nombre: "Tacos de trompo", cantidad: 3 }]);
  assert.equal(carta.estado.nota, null);
  assert.match(carta.mensajes[0].texto, /• 3 × Tacos de trompo — \$75/);

  // La clave de la confirmación es el mensaje que la puso en pantalla.
  const r = responder({
    ficha: ficha(),
    chat: { estado: conversar(ficha(), hastaConfirmar.slice(0, 4)).at(-1).estado },
    entrada: { ...op("e:llevar"), id: "wamid.pantalla" },
    ahora: NOCHE,
  });
  assert.equal(r.estado.clave, "wamid.pantalla");
  const ok = responder({ ficha: ficha(), chat: { estado: r.estado }, entrada: { ...op("f:confirmar"), id: "wamid.si" }, ahora: NOCHE });
  assert.equal(ok.pedido.clave, "wamid.pantalla");
});

test("la dirección: cambiar de idea no es una dirección, y una ubicación rota se vuelve a pedir", () => {
  const turnos = conversar(ficha(), [op("o:pedir"), op("p:p-bistec"), op("c:1"), op("k:terminar"), op("e:domicilio"), "mejor para llevar"]);
  const fin = turnos.at(-1);
  assert.equal(fin.estado.entrega, "llevar");
  assert.equal(fin.estado.direccion, null);
  assert.equal(fin.estado.paso, "confirmar");

  const rota = responder({
    ficha: ficha(),
    chat: { estado: turnos.at(-2).estado },
    entrada: { tipo: "ubicacion", ubicacion: { lat: NaN, lng: undefined } },
    ahora: NOCHE,
  });
  assert.equal(rota.estado.paso, "direccion");
  assert.match(rota.mensajes[0].texto, /^No pude leer esa ubicación\./);
});

test("un carrito que se quedó sin nada que pedir nunca llega a la confirmación", () => {
  // Machacado en el carrito, pero a las ocho de la noche el desayuno ya no se sirve.
  const estado = {
    paso: "carrito",
    carrito: [{ id: "p-machacado", nombre: "Machacado con huevo", cantidad: 1 }],
    actualizado: NOCHE.toISOString(),
  };
  const r = responder({ ficha: ficha(), chat: { estado }, entrada: op("k:terminar"), ahora: NOCHE });
  assert.doesNotMatch(r.mensajes[0].texto, /null|Revisa tu pedido/);
  assert.match(r.mensajes[0].texto, /Esto ya no está disponible y lo quité: Machacado con huevo\./);
  assert.deepEqual(r.estado.carrito, []);
});

test("quien escribe por primera vez recibe un saludo antes de la respuesta", () => {
  const [r] = conversar(ficha(), ["a qué hora cierran?"], { nuevo: true });
  assert.match(r.mensajes[0].texto, /^¡Hola! Soy el asistente de Taquería El Trompo\.\n\nNuestro horario:/);
  const [hola] = conversar(ficha(), ["hola"], { nuevo: true });
  assert.doesNotMatch(hola.mensajes[0].texto, /¡Hola! Soy el asistente[\s\S]*¡Hola/);
});

test("las listas largas se paginan dentro del tope de diez filas", () => {
  const muchos = Array.from({ length: 15 }, (_, i) => ({
    id: `t${i}`,
    name: `Taco ${i + 1}`,
    price_cents: 2000,
    currency: "MXN",
    is_available: true,
  }));
  const f = ficha({
    menus: [{ id: "m", name: "Carta", kind: "digital", service_time: "siempre", grupos: [{ id: "g1", name: "Tacos", items: muchos }, { id: "g2", name: "Bebidas", items: [muchos[0]] }] }],
  });
  const [, pagina1, pagina2] = conversar(f, [op("o:pedir"), op("g:g1"), op("pm:g1:1")]);
  const p1 = ids(pagina1.mensajes[0]);
  assert.equal(p1.length, 10);
  assert.deepEqual(p1.slice(-2), ["pm:g1:1", "g+:0"]);
  const p2 = ids(pagina2.mensajes[0]);
  assert.deepEqual(p2.slice(-2), ["pm:g1:0", "g+:0"], "la última página vuelve al principio");
  assert.equal(p2.length, 9);
});
