// La Cloud API de WhatsApp, en lo que no habla con nadie: leer el webhook de
// Meta, comprobar su firma y traducir los mensajes del asistente a lo que la
// API acepta, con sus límites de largo. Las llamadas de verdad están en
// `lib/meta.js`, que es lo único que necesita la llave.

import { createHmac, timingSafeEqual } from "crypto";

// Contestar sin plantilla solo se puede dentro de las 24 horas desde el último
// mensaje del cliente. Un mensaje que llega más viejo que eso (Meta reintenta
// durante días lo que no pudo entregar) ya no se contesta.
export const VENTANA_MS = 24 * 60 * 60 * 1000;
const MARGEN_VENTANA_MS = 60 * 60 * 1000;

/**
 * La firma de un webhook de Meta.
 *
 * Llega en `x-hub-signature-256` como `sha256=<hmac>`, calculado con el
 * secreto de la aplicación sobre el cuerpo tal cual llegó —los bytes, no el
 * JSON vuelto a escribir—, así que se comprueba antes de parsear. Se compara
 * en tiempo constante.
 */
export function firmaDeMetaValida(cuerpo, cabecera, secreto) {
  if (!secreto) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(String(cabecera ?? "").trim());
  if (!m) return false;
  const esperada = createHmac("sha256", secreto).update(String(cuerpo ?? ""), "utf8").digest();
  const recibida = Buffer.from(m[1], "hex");
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

// El token con el que Meta verifica el webhook al suscribirlo (el GET con
// `hub.challenge`). También en tiempo constante: es un secreto.
export function tokenDeVerificacionValido(recibido, esperado) {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && timingSafeEqual(a, b);
}

function soloDigitos(valor) {
  const d = String(valor ?? "").replace(/\D/g, "");
  return /^[0-9]{6,20}$/.test(d) ? d : null;
}

// Un id de usuario de empresa (BSUID): "MX.1234…". Desde 2026 llega junto al
// teléfono y, para quien esconde su número, en lugar de él.
function usuarioValido(valor) {
  const v = String(valor ?? "").trim();
  return /^[A-Za-z]{2}\.[A-Za-z0-9]{1,128}$/.test(v) ? v : null;
}

// Lo que el asistente entiende de cada tipo de mensaje. Lo que devuelve
// `null` se ignora sin contestar: una reacción o una calcomanía no piden
// respuesta, y contestarlas costaría un mensaje.
function entradaDe(m) {
  switch (m?.type) {
    case "text":
      return { tipo: "texto", texto: String(m.text?.body ?? "") };
    case "interactive": {
      const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
      return r ? { tipo: "opcion", opcion: String(r.id ?? ""), texto: String(r.title ?? "") } : null;
    }
    case "button":
      // Un botón de respuesta rápida de una plantilla: se lee como lo que dice.
      return { tipo: "texto", texto: String(m.button?.text ?? m.button?.payload ?? "") };
    case "location":
      return {
        tipo: "ubicacion",
        ubicacion: {
          lat: Number(m.location?.latitude),
          lng: Number(m.location?.longitude),
          nombre: m.location?.name ? String(m.location.name) : null,
          direccion: m.location?.address ? String(m.location.address) : null,
        },
      };
    case "image":
    case "video":
    case "document": {
      // Una foto con texto al pie trae la pregunta en el pie.
      const pie = m[m.type]?.caption;
      return pie ? { tipo: "texto", texto: String(pie) } : { tipo: "medio" };
    }
    case "audio":
    case "contacts":
      return { tipo: "medio" };
    case "request_welcome":
      // Quien abre el chat por primera vez, antes de escribir nada.
      return { tipo: "texto", texto: "hola" };
    default:
      return null;
  }
}

/**
 * Lo que trae un aviso del webhook: los mensajes de clientes y los "ecos" de
 * lo que el restaurante contestó a mano desde la app de WhatsApp Business
 * (coexistencia), que es la señal para que el asistente se calle en ese chat.
 *
 * Cada mensaje sale con su línea (`phone_number_id`), su id, cuándo se mandó,
 * quién lo mandó —teléfono y BSUID, lo que venga— y qué dice. Los avisos de
 * estado (entregado, leído) no traen nada que contestar y se ignoran.
 */
export function leerAviso(aviso) {
  const mensajes = [];
  const ecos = [];
  if (aviso?.object !== "whatsapp_business_account") return { mensajes, ecos };

  for (const entrada of aviso.entry ?? []) {
    for (const cambio of entrada?.changes ?? []) {
      const v = cambio?.value ?? {};
      const linea = String(v.metadata?.phone_number_id ?? "");
      if (!/^[0-9]{5,30}$/.test(linea)) continue;

      if (cambio.field === "messages") {
        const contactos = Array.isArray(v.contacts) ? v.contacts : [];
        for (const m of Array.isArray(v.messages) ? v.messages : []) {
          const telefono = soloDigitos(m?.from);
          const usuario = usuarioValido(m?.from_user_id);
          const contacto =
            contactos.find((c) => (telefono && soloDigitos(c?.wa_id) === telefono) || (usuario && c?.user_id === usuario)) ??
            (contactos.length === 1 ? contactos[0] : null);
          const cliente = {
            telefono: telefono ?? soloDigitos(contacto?.wa_id),
            usuario: usuario ?? usuarioValido(contacto?.user_id),
            nombre: contacto?.profile?.name ? String(contacto.profile.name).slice(0, 80) : null,
          };
          const leido = entradaDe(m);
          if (!leido || !m?.id || (!cliente.telefono && !cliente.usuario)) continue;
          mensajes.push({
            linea,
            id: String(m.id).slice(0, 200),
            momento: Number(m.timestamp) * 1000,
            cliente,
            nombre: cliente.nombre,
            ...leido,
          });
        }
      } else if (cambio.field === "smb_message_echoes") {
        for (const m of Array.isArray(v.message_echoes) ? v.message_echoes : []) {
          const para = { telefono: soloDigitos(m?.to), usuario: usuarioValido(m?.to_user_id) };
          if (para.telefono || para.usuario) ecos.push({ linea, id: String(m?.id ?? ""), para });
        }
      }
    }
  }
  return { mensajes, ecos };
}

// Un mensaje que llegó demasiado tarde para contestarlo sin plantilla. Se deja
// una hora de margen para no contestar en el filo de la ventana.
export function fueraDeTiempo(momento, ahora = Date.now()) {
  return !Number.isFinite(momento) || ahora - momento > VENTANA_MS - MARGEN_VENTANA_MS;
}

// ---------------------------------------------------------------------------
// De mensaje del asistente a lo que acepta la API
// ---------------------------------------------------------------------------

// Los límites de la Cloud API. Pasarse de uno no recorta: la API rechaza el
// mensaje entero y el cliente se queda sin respuesta. Por eso se recorta aquí.
export const LIMITES = {
  texto: 4096,
  cuerpo: 1024,
  botones: 3,
  tituloBoton: 20,
  idBoton: 256,
  filas: 10,
  tituloFila: 24,
  descripcionFila: 72,
  idFila: 200,
  tituloSeccion: 24,
  botonLista: 20,
  pie: 1024,
  archivo: 240,
};

export function recortar(texto, maximo) {
  const t = String(texto ?? "").trim();
  return t.length <= maximo ? t : `${t.slice(0, maximo - 1).trimEnd()}…`;
}

// Un párrafo que no cabe en un mensaje se corta en el último espacio antes
// del límite —o en el límite, si no hay ninguno— y sigue en el siguiente.
function trozarParrafo(parrafo, maximo) {
  const trozos = [];
  let resto = parrafo;
  while (resto.length > maximo) {
    const corte = resto.lastIndexOf(" ", maximo);
    const en = corte > maximo / 2 ? corte : maximo;
    trozos.push(resto.slice(0, en).trimEnd());
    resto = resto.slice(en).trimStart();
  }
  if (resto) trozos.push(resto);
  return trozos;
}

// Un texto de más de 4096 caracteres se parte por párrafos, y el párrafo que
// no cabe, por palabras: nada se tira. Ninguna respuesta del asistente llega
// a tanto, pero un pedido de veinte renglones con notas no debería ser el que
// descubra el límite.
function partirTexto(texto, maximo = LIMITES.texto) {
  const partes = [];
  let actual = "";
  for (const parrafo of String(texto ?? "").split("\n\n")) {
    const junto = actual ? `${actual}\n\n${parrafo}` : parrafo;
    if (junto.length <= maximo) {
      actual = junto;
      continue;
    }
    if (actual) partes.push(actual);
    const trozos = trozarParrafo(parrafo, maximo);
    actual = trozos.pop() ?? "";
    partes.push(...trozos);
  }
  if (actual) partes.push(actual);
  return partes.length ? partes : [""];
}

// A quién se manda: al teléfono si se tiene, que es lo que Meta recomienda; al
// BSUID solo cuando el cliente escondió su número.
export function destinoDe(cliente) {
  if (cliente?.telefono) return { to: cliente.telefono };
  if (cliente?.usuario) return { recipient: cliente.usuario };
  return null;
}

// El cuerpo de un mensaje con botones o lista admite 1024 caracteres. Uno más
// largo va antes como texto, y los botones salen con una línea corta.
function conCuerpo(texto) {
  const t = String(texto ?? "").trim() || "Elige una opción:";
  if (t.length <= LIMITES.cuerpo) return { antes: [], cuerpo: t };
  return { antes: partirTexto(t), cuerpo: "Elige una opción:" };
}

/**
 * Un mensaje del asistente (`lib/asistente.js`) como uno o más cuerpos de
 * `POST /{phone_number_id}/messages`. Casi siempre es uno; son dos solo
 * cuando un texto no cabe en el cuerpo de unos botones.
 */
export function aPayloads(destino, mensaje) {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", ...destino };
  const comoTexto = (t) => ({ ...base, type: "text", text: { body: t, preview_url: true } });

  switch (mensaje?.tipo) {
    case "texto":
      return partirTexto(mensaje.texto).map(comoTexto);

    case "botones": {
      const botones = (mensaje.botones ?? []).slice(0, LIMITES.botones);
      if (!botones.length) return aPayloads(destino, { tipo: "texto", texto: mensaje.texto });
      const { antes, cuerpo } = conCuerpo(mensaje.texto);
      return [
        ...antes.map(comoTexto),
        {
          ...base,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: cuerpo },
            action: {
              buttons: botones.map((b) => ({
                type: "reply",
                reply: { id: recortar(b.id, LIMITES.idBoton), title: recortar(b.titulo, LIMITES.tituloBoton) },
              })),
            },
          },
        },
      ];
    }

    case "lista": {
      let quedan = LIMITES.filas;
      const secciones = (mensaje.secciones ?? [])
        .map((s) => {
          const filas = (s.filas ?? []).slice(0, Math.max(quedan, 0));
          quedan -= filas.length;
          return {
            title: recortar(s.titulo, LIMITES.tituloSeccion),
            rows: filas.map((f) => ({
              id: recortar(f.id, LIMITES.idFila),
              title: recortar(f.titulo, LIMITES.tituloFila),
              ...(String(f.descripcion ?? "").trim()
                ? { description: recortar(f.descripcion, LIMITES.descripcionFila) }
                : {}),
            })),
          };
        })
        .filter((s) => s.rows.length);
      if (!secciones.length) return aPayloads(destino, { tipo: "texto", texto: mensaje.texto });
      const { antes, cuerpo } = conCuerpo(mensaje.texto);
      return [
        ...antes.map(comoTexto),
        {
          ...base,
          type: "interactive",
          interactive: {
            type: "list",
            body: { text: cuerpo },
            action: { button: recortar(mensaje.boton || "Ver opciones", LIMITES.botonLista), sections: secciones },
          },
        },
      ];
    }

    case "documento":
      return [
        {
          ...base,
          type: "document",
          document: {
            link: mensaje.url,
            filename: recortar(mensaje.nombre || "menu.pdf", LIMITES.archivo),
            ...(mensaje.texto ? { caption: recortar(mensaje.texto, LIMITES.pie) } : {}),
          },
        },
      ];

    case "imagen":
      return [
        {
          ...base,
          type: "image",
          image: { link: mensaje.url, ...(mensaje.texto ? { caption: recortar(mensaje.texto, LIMITES.pie) } : {}) },
        },
      ];

    default:
      return [];
  }
}

// El error de Meta cuando ya pasaron las 24 horas: el cliente solo se puede
// contactar con una plantilla aprobada.
export const ERROR_FUERA_DE_VENTANA = 131047;
