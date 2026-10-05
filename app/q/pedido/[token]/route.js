import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseSession } from "../../../../lib/supabase";
import { rutaFicha } from "../../../../lib/slug";
import { ponerVisitante, visitanteDe } from "../../visitante";

// El enlace que el asistente de WhatsApp le manda al cliente cuando su pedido
// se entrega: /q/pedido/<token>. Abrirlo le deja un pase de visita, como
// escanear el QR de la mesa, y lo lleva a las reseñas de la ficha: la compra
// es la prueba, y su reseña sale verificada.
//
// El token es de ese pedido y se gasta la primera vez (`pase_de_pedido`): un
// enlace reenviado lleva a la ficha, pero sin pase. Por eso los robots que
// arman la vista previa de un enlace no lo abren de verdad: si lo gastaran,
// el cliente llegaría sin pase. El mensaje ya va sin vista previa; esto es por
// si alguien lo pega en otro chat.
export const dynamic = "force-dynamic";

const ROBOTS_DE_VISTA_PREVIA =
  /facebookexternalhit|facebot|whatsapp|meta-externalagent|telegrambot|twitterbot|slackbot|discordbot|linkedinbot/i;

export async function GET(request, { params }) {
  const { token } = await params;
  const limpio = String(token ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(limpio)) return new Response(null, { status: 404 });

  if (ROBOTS_DE_VISTA_PREVIA.test(request.headers.get("user-agent") ?? "")) {
    return NextResponse.redirect(new URL("/", request.url), 307);
  }

  const { visitante, nueva } = visitanteDe(await cookies());

  let ficha = null;
  try {
    const supabase = await supabaseSession();
    const { data, error } = await supabase.rpc("pase_de_pedido", { p_token: limpio, p_visitante: visitante });
    if (error) throw error;
    ficha = data ?? null;
  } catch (error) {
    console.error("pase de pedido", error?.message);
  }
  if (!ficha) return new Response(null, { status: 404 });

  // `src=pedido` para que el tablero no lo cuente como un escaneo en la mesa.
  const respuesta = NextResponse.redirect(new URL(`${rutaFicha(ficha)}?src=pedido#resenas`, request.url), 307);
  if (nueva) ponerVisitante(respuesta, visitante);
  return respuesta;
}
