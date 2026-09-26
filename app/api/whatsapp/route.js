import { after } from "next/server";
import { reportarError } from "../../../lib/errores";
import { firmaDeMetaValida, tokenDeVerificacionValido } from "../../../lib/whatsapp-cloud";
import { atenderAviso } from "./atender";

// El webhook de la Cloud API de WhatsApp: por aquí llegan los mensajes que los
// clientes les escriben a los restaurantes conectados.
//
// Meta pide un 200 rápido y reintenta lo que no lo recibe, así que la ruta
// solo comprueba la firma y contesta; el mensaje se atiende después, con
// `after`, en la misma función. Si atenderlo falla, el error va a los logs y a
// `ERRORES_WEBHOOK_URL`, no de vuelta a Meta: un reintento no arreglaría un
// fallo nuestro, y el mismo mensaje atendido dos veces pueden ser dos pedidos.
export const dynamic = "force-dynamic";

// Una conversación con pedido —leer la ficha, guardar, contestar, avisar al
// dueño— son unos cuantos segundos; el minuto es el techo.
export const maxDuration = 60;

// La verificación al suscribir el webhook en el panel de Meta: si el token es
// el nuestro, se devuelve el reto tal cual.
export async function GET(request) {
  const url = new URL(request.url);
  const reto = url.searchParams.get("hub.challenge");
  const valido =
    url.searchParams.get("hub.mode") === "subscribe" &&
    tokenDeVerificacionValido(url.searchParams.get("hub.verify_token"), process.env.WHATSAPP_VERIFY_TOKEN);

  if (!valido || !reto) return new Response(null, { status: 403 });
  return new Response(reto, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto) {
    console.error("whatsapp: falta WHATSAPP_APP_SECRET; se rechaza el webhook");
    return new Response(null, { status: 503 });
  }

  // La firma es sobre los bytes que llegaron, así que se lee como texto y se
  // comprueba antes de parsear nada.
  const cuerpo = await request.text();
  if (!firmaDeMetaValida(cuerpo, request.headers.get("x-hub-signature-256"), secreto)) {
    return new Response(null, { status: 401 });
  }

  let aviso;
  try {
    aviso = JSON.parse(cuerpo);
  } catch {
    return new Response(null, { status: 400 });
  }

  after(() =>
    atenderAviso(aviso).catch((error) => reportarError(error, { ruta: "/api/whatsapp", metodo: "POST" })),
  );
  return new Response(null, { status: 200 });
}
