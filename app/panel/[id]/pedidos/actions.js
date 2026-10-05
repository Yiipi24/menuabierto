"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enviarMensajes, esFueraDeVentana, whatsappConfigurado } from "../../../../lib/meta";
import { avisoDeEstado, estadoDePedido } from "../../../../lib/pedidos";
import { urlDelSitio } from "../../../../lib/sitio";
import { qrCodigoValido } from "../../../../lib/slug";
import { supabaseSession } from "../../../../lib/supabase";

const NO_ES_TUYO = { status: "error", message: "Ese restaurante no es tuyo." };

// Lo que dice la base cuando algo no cuadra, en palabras del dueño.
const ERRORES = {
  cambio_no_permitido: "Ese pedido ya había cambiado. Recarga la página para ver cómo va.",
  pedido_no_existe: "Ese pedido ya no existe.",
  solo_el_dueno: NO_ES_TUYO.message,
};

// Cómo se le dice al dueño que su clic sí llegó al cliente.
const AVISADO = {
  aceptado: "Le avisamos al cliente que ya lo están preparando.",
  listo: "Le avisamos al cliente que está listo.",
  cancelado: "Le avisamos al cliente que no se pudo tomar.",
  entregado: "Le pedimos su reseña por WhatsApp.",
};

// El enlace de la reseña es el del QR de la mesa: le deja al cliente el mismo
// pase de visita, y con él su reseña sale verificada. `de=pedido` lo manda a
// las reseñas de la ficha sin contarlo como un escaneo en el local.
function enlaceDeResena(qrCode) {
  return qrCodigoValido(qrCode) ? urlDelSitio(`/q/${qrCode}?de=pedido`) : null;
}

/**
 * Mover un pedido: aceptarlo, marcarlo listo, entregado o cancelado.
 *
 * El cambio lo hace `cambiar_estado_pedido()` en la base, que comprueba que
 * quien lo pide es el dueño y que el paso es válido. Después se le avisa al
 * cliente por el mismo WhatsApp por el que pidió, con el token del servidor:
 * el dueño no tiene que escribirle a mano "ya está tu pedido".
 *
 * El aviso puede fallar sin deshacer el cambio —pasaron más de 24 horas desde
 * el último mensaje del cliente, o Meta no contestó— y entonces se dice, para
 * que el dueño le escriba él.
 */
export async function cambiarEstadoPedido(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const pedidoId = String(formData.get("pedido") ?? "");
  const siguiente = String(formData.get("estado") ?? "");
  if (!estadoDePedido(siguiente)) return { status: "error", message: "Ese estado no existe." };

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, phone, qr_code")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!restaurante) return NO_ES_TUYO;

  // Que el pedido sea de este restaurante se comprueba antes: un dueño con
  // dos sucursales es dueño de los pedidos de las dos, y la función aceptaría
  // mover el de la otra desde esta pantalla.
  const { data: suyo } = await supabase
    .from("orders")
    .select("id")
    .eq("id", pedidoId)
    .eq("restaurant_id", restaurante.id)
    .maybeSingle();
  if (!suyo) return { status: "error", message: ERRORES.pedido_no_existe };

  const { data, error } = await supabase.rpc("cambiar_estado_pedido", {
    p_order: pedidoId,
    p_status: siguiente,
  });
  const fila = data?.[0];
  if (error || !fila) {
    if (error) console.error("cambiar estado pedido", error.message);
    return { status: "error", message: ERRORES[error?.message] ?? "No pudimos cambiar el pedido." };
  }

  revalidatePath(`/panel/${id}/pedidos`);
  revalidatePath(`/panel/${id}`);

  const hecho = `Pedido ${fila.code}: ${estadoDePedido(fila.status).nombre.toLowerCase()}.`;
  const texto = avisoDeEstado({
    status: fila.status,
    codigo: fila.code,
    entrega: fila.delivery,
    telefono: String(restaurante.phone ?? "").trim() || null,
    resena: enlaceDeResena(restaurante.qr_code),
  });
  if (!texto) return { status: "ok", message: hecho };

  const { data: linea } = await supabase
    .from("whatsapp_lines")
    .select("phone_number_id, is_active")
    .eq("restaurant_id", restaurante.id)
    .maybeSingle();
  if (!linea?.is_active || !whatsappConfigurado()) {
    return { status: "ok", message: `${hecho} Avísale tú al cliente: el asistente no está conectado.` };
  }

  try {
    await enviarMensajes(
      linea.phone_number_id,
      { telefono: fila.customer_phone, usuario: fila.customer_user_id },
      [{ tipo: "texto", texto }],
    );
    return { status: "ok", message: `${hecho} ${AVISADO[fila.status]}` };
  } catch (fallo) {
    console.error("aviso al cliente", fallo?.message);
    return {
      status: "aviso",
      message: esFueraDeVentana(fallo)
        ? `${hecho} No le pudimos avisar por WhatsApp: pasaron más de 24 horas desde su último mensaje. Escríbele tú.`
        : `${hecho} No le pudimos avisar por WhatsApp. Escríbele tú.`,
    };
  }
}
