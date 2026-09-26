// Las llamadas a la Cloud API de WhatsApp. Solo del lado del servidor: el
// token manda mensajes a nombre de cada restaurante conectado, así que no sale
// de las variables de entorno.
//
// Un solo token para todos los números: el de un usuario del sistema del
// portafolio de Menú Abierto, con permiso sobre las cuentas de WhatsApp de los
// restaurantes que se conectan. Qué número es de qué ficha lo dice la tabla
// `whatsapp_lines`, no el token.

import { ERROR_FUERA_DE_VENTANA, aPayloads, destinoDe } from "./whatsapp-cloud";

const API = "https://graph.facebook.com";

// La versión de la Graph API se fija para que un cambio de Meta no llegue sin
// avisar; cada versión dura unos dos años. Se mueve con la variable, sin
// desplegar.
export const VERSION_GRAPH = /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION ?? "")
  ? process.env.WHATSAPP_GRAPH_VERSION
  : "v24.0";

export function whatsappConfigurado() {
  return Boolean(process.env.WHATSAPP_TOKEN);
}

async function llamar(ruta, cuerpo) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error("Falta WHATSAPP_TOKEN.");

  const respuesta = await fetch(`${API}/${VERSION_GRAPH}${ruta}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    const detalle = datos?.error?.message ?? texto.slice(0, 200);
    const error = new Error(`WhatsApp ${respuesta.status}: ${detalle}`);
    error.status = respuesta.status;
    error.codigo = datos?.error?.code ?? null;
    throw error;
  }
  return datos;
}

/**
 * Manda los mensajes en orden, uno tras otro: el PDF del menú tiene que
 * llegar antes que el texto que dice "ahí está". Lanza con el primero que
 * falle; los que ya salieron, salieron.
 */
export async function enviarMensajes(lineaId, cliente, mensajes) {
  const destino = destinoDe(cliente);
  if (!destino) throw new Error("El cliente no trae ni teléfono ni id de usuario.");
  for (const mensaje of mensajes ?? []) {
    for (const cuerpo of aPayloads(destino, mensaje)) {
      await llamar(`/${encodeURIComponent(lineaId)}/messages`, cuerpo);
    }
  }
}

// Las dos palomitas azules: el cliente ve que su mensaje se leyó mientras el
// asistente arma la respuesta.
export async function marcarLeido(lineaId, mensajeId) {
  return llamar(`/${encodeURIComponent(lineaId)}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: mensajeId,
  });
}

export function esFueraDeVentana(error) {
  return error?.codigo === ERROR_FUERA_DE_VENTANA;
}
