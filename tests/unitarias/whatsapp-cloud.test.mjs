import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  aPayloads,
  destinoDe,
  firmaDeMetaValida,
  fueraDeTiempo,
  leerAviso,
  recortar,
  tokenDeVerificacionValido,
  LIMITES,
} from "../../lib/whatsapp-cloud.js";

const SECRETO = "secreto-de-la-app";
const firmar = (cuerpo) => `sha256=${createHmac("sha256", SECRETO).update(cuerpo, "utf8").digest("hex")}`;

test("la firma de Meta se comprueba sobre los bytes que llegaron", () => {
  const cuerpo = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  assert.equal(firmaDeMetaValida(cuerpo, firmar(cuerpo), SECRETO), true);
  assert.equal(firmaDeMetaValida(cuerpo, firmar(cuerpo).toUpperCase().replace("SHA256", "sha256"), SECRETO), true);
  // Un espacio de más ya es otro cuerpo.
  assert.equal(firmaDeMetaValida(`${cuerpo} `, firmar(cuerpo), SECRETO), false);
  assert.equal(firmaDeMetaValida(cuerpo, firmar(cuerpo), "otro"), false);
  assert.equal(firmaDeMetaValida(cuerpo, null, SECRETO), false);
  assert.equal(firmaDeMetaValida(cuerpo, "sha256=abc", SECRETO), false);
  assert.equal(firmaDeMetaValida(cuerpo, firmar(cuerpo), ""), false);
  // Acentos: la firma es sobre UTF-8.
  const conAcentos = JSON.stringify({ texto: "¿A qué hora abren? ñ" });
  assert.equal(firmaDeMetaValida(conAcentos, firmar(conAcentos), SECRETO), true);

  assert.equal(tokenDeVerificacionValido("abc", "abc"), true);
  assert.equal(tokenDeVerificacionValido("abd", "abc"), false);
  assert.equal(tokenDeVerificacionValido("abc", undefined), false);
  assert.equal(tokenDeVerificacionValido(null, "abc"), false);
});

function aviso(value, field = "messages") {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field, value: { messaging_product: "whatsapp", metadata: { display_phone_number: "528112345678", phone_number_id: "106540352242922" }, ...value } }] }],
  };
}

test("el webhook: texto, botones, listas, ubicación y lo que se ignora", () => {
  const { mensajes, ecos } = leerAviso(
    aviso({
      contacts: [{ profile: { name: "Ana María" }, wa_id: "5218111111111", user_id: "MX.123abc" }],
      messages: [
        { from: "5218111111111", from_user_id: "MX.123abc", id: "wamid.1", timestamp: "1790000000", type: "text", text: { body: "¿A qué hora abren?" } },
        { from: "5218111111111", id: "wamid.2", timestamp: "1790000001", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "c:2", title: "2" } } },
        { from: "5218111111111", id: "wamid.3", timestamp: "1790000002", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "p:abc", title: "Tacos" } } },
        { from: "5218111111111", id: "wamid.4", timestamp: "1790000003", type: "location", location: { latitude: 25.67, longitude: -100.31, name: "Casa", address: "Calle 5" } },
        { from: "5218111111111", id: "wamid.5", timestamp: "1790000004", type: "reaction", reaction: { emoji: "👍" } },
        { from: "5218111111111", id: "wamid.6", timestamp: "1790000005", type: "audio", audio: { id: "x" } },
        { from: "5218111111111", id: "wamid.7", timestamp: "1790000006", type: "image", image: { id: "x", caption: "¿Tienen esto?" } },
      ],
    }),
  );
  assert.deepEqual(ecos, []);
  assert.deepEqual(
    mensajes.map((m) => [m.id, m.tipo, m.texto ?? m.opcion ?? null]),
    [
      ["wamid.1", "texto", "¿A qué hora abren?"],
      ["wamid.2", "opcion", "2"],
      ["wamid.3", "opcion", "Tacos"],
      ["wamid.4", "ubicacion", null],
      ["wamid.6", "medio", null],
      ["wamid.7", "texto", "¿Tienen esto?"],
    ],
  );
  assert.equal(mensajes[1].opcion, "c:2");
  assert.deepEqual(mensajes[0].cliente, { telefono: "5218111111111", usuario: "MX.123abc", nombre: "Ana María" });
  assert.equal(mensajes[0].linea, "106540352242922");
  assert.equal(mensajes[0].momento, 1790000000 * 1000);
  assert.deepEqual(mensajes[3].ubicacion, { lat: 25.67, lng: -100.31, nombre: "Casa", direccion: "Calle 5" });
});

test("el webhook: quien escondió su número llega solo con su BSUID", () => {
  const { mensajes } = leerAviso(
    aviso({
      contacts: [{ profile: { name: "Luis" }, user_id: "MX.998877" }],
      messages: [{ from_user_id: "MX.998877", id: "wamid.9", timestamp: "1790000000", type: "text", text: { body: "hola" } }],
    }),
  );
  assert.deepEqual(mensajes[0].cliente, { telefono: null, usuario: "MX.998877", nombre: "Luis" });
  assert.deepEqual(destinoDe(mensajes[0].cliente), { recipient: "MX.998877" });
  assert.deepEqual(destinoDe({ telefono: "5218111111111", usuario: "MX.1" }), { to: "5218111111111" });
  assert.equal(destinoDe({}), null);

  // Sin nadie a quien contestar, o sin id, no hay mensaje.
  const vacio = leerAviso(aviso({ messages: [{ id: "wamid.x", type: "text", text: { body: "hola" } }, { from: "5218111111111", type: "text", text: { body: "sin id" } }] }));
  assert.deepEqual(vacio.mensajes, []);
});

test("el webhook: ecos del dueño, avisos de estado y lo que no es de WhatsApp", () => {
  const { ecos, mensajes } = leerAviso(
    aviso(
      { message_echoes: [{ from: "528112345678", to: "5218111111111", id: "wamid.e1", timestamp: "1790000000", type: "text", text: { body: "Ahorita te lo mando" } }] },
      "smb_message_echoes",
    ),
  );
  assert.deepEqual(mensajes, []);
  assert.deepEqual(ecos, [{ linea: "106540352242922", id: "wamid.e1", para: { telefono: "5218111111111", usuario: null } }]);

  assert.deepEqual(leerAviso(aviso({ statuses: [{ id: "wamid.1", status: "read" }] })), { mensajes: [], ecos: [] });
  assert.deepEqual(leerAviso({ object: "page", entry: [] }), { mensajes: [], ecos: [] });
  assert.deepEqual(leerAviso(null), { mensajes: [], ecos: [] });
  const sinLinea = aviso({ messages: [{ from: "5218111111111", id: "w", timestamp: "1", type: "text", text: { body: "x" } }] });
  sinLinea.entry[0].changes[0].value.metadata.phone_number_id = "../../me";
  assert.deepEqual(leerAviso(sinLinea).mensajes, []);
});

test("un mensaje viejo ya no se contesta", () => {
  const ahora = Date.parse("2026-09-28T20:00:00Z");
  assert.equal(fueraDeTiempo(ahora - 60_000, ahora), false);
  assert.equal(fueraDeTiempo(ahora - 22 * 3600_000, ahora), false);
  assert.equal(fueraDeTiempo(ahora - 23.5 * 3600_000, ahora), true);
  assert.equal(fueraDeTiempo(NaN, ahora), true);
});

test("los mensajes del asistente, dentro de los límites de la API", () => {
  const destino = { to: "5218111111111" };

  const [t] = aPayloads(destino, { tipo: "texto", texto: "Hola" });
  assert.deepEqual(t, { messaging_product: "whatsapp", recipient_type: "individual", to: "5218111111111", type: "text", text: { body: "Hola", preview_url: true } });
  // El enlace de la reseña va sin vista previa: el robot no debe gastarlo.
  const [sin] = aPayloads(destino, { tipo: "texto", texto: "Tu reseña: https://x/q/pedido/abc", sinVistaPrevia: true });
  assert.equal(sin.text.preview_url, false);

  const [b] = aPayloads(destino, {
    tipo: "botones",
    texto: "¿Cómo lo quieres?",
    botones: [
      { id: "e:sitio", titulo: "Para comer aquí" },
      { id: "e:llevar", titulo: "Para llevar" },
      { id: "e:domicilio", titulo: "A domicilio" },
      { id: "de-mas", titulo: "Un cuarto botón" },
    ],
  });
  assert.equal(b.interactive.type, "button");
  assert.equal(b.interactive.action.buttons.length, LIMITES.botones);
  assert.deepEqual(b.interactive.action.buttons[0], { type: "reply", reply: { id: "e:sitio", title: "Para comer aquí" } });

  // Un cuerpo de más de 1024 caracteres va antes como texto.
  const largo = aPayloads(destino, { tipo: "botones", texto: "x".repeat(1500), botones: [{ id: "a", titulo: "Un botón con un título larguísimo" }] });
  assert.equal(largo.length, 2);
  assert.equal(largo[0].type, "text");
  assert.equal(largo[1].interactive.body.text, "Elige una opción:");
  assert.ok(largo[1].interactive.action.buttons[0].reply.title.length <= LIMITES.tituloBoton);

  const filas = Array.from({ length: 12 }, (_, i) => ({ id: `p:${i}`, titulo: `Platillo con un nombre muy largo número ${i}`, descripcion: i === 0 ? "" : "d".repeat(100) }));
  const [l] = aPayloads(destino, { tipo: "lista", texto: "Elige", boton: "Ver los platillos del menú", secciones: [{ titulo: "Una sección con nombre largo", filas }] });
  const seccion = l.interactive.action.sections[0];
  assert.equal(seccion.rows.length, LIMITES.filas);
  // Recortado quiere decir dentro del límite y con su "…", no justo en él:
  // el corte no deja un espacio antes de los puntos.
  const cabe = (texto, limite) => texto.length <= limite && texto.endsWith("…");
  assert.ok(cabe(seccion.title, LIMITES.tituloSeccion), seccion.title);
  assert.ok(cabe(seccion.rows[1].title, LIMITES.tituloFila), seccion.rows[1].title);
  assert.ok(cabe(seccion.rows[1].description, LIMITES.descripcionFila));
  assert.equal("description" in seccion.rows[0], false, "una descripción vacía no se manda");
  assert.ok(cabe(l.interactive.action.button, LIMITES.botonLista));

  const [d] = aPayloads(destino, { tipo: "documento", url: "https://x/menu.pdf", nombre: "Menú.pdf", texto: "Nuestro menú" });
  assert.deepEqual(d.document, { link: "https://x/menu.pdf", filename: "Menú.pdf", caption: "Nuestro menú" });
  const [img] = aPayloads({ recipient: "MX.1" }, { tipo: "imagen", url: "https://x/menu.jpg" });
  assert.deepEqual(img.image, { link: "https://x/menu.jpg" });
  assert.equal(img.recipient, "MX.1");

  // Un solo párrafo de más de 4096 caracteres se parte por palabras, sin tirar
  // nada.
  const palabras = Array.from({ length: 1500 }, (_, i) => `palabra${i}`);
  const partes = aPayloads(destino, { tipo: "texto", texto: palabras.join(" ") });
  assert.ok(partes.length >= 3);
  assert.ok(partes.every((p) => p.text.body.length <= LIMITES.texto));
  assert.deepEqual(partes.map((p) => p.text.body).join(" ").split(" "), palabras);

  assert.equal(recortar("abcdef", 4), "abc…");
  assert.equal(recortar("  abc  ", 4), "abc");
  assert.deepEqual(aPayloads(destino, { tipo: "desconocido" }), []);
  assert.equal(aPayloads(destino, { tipo: "botones", texto: "sin botones", botones: [] })[0].type, "text");
});
