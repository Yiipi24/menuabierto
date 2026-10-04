import { firmaValida, idDePagoEnAviso, idDeSuscripcionEnAviso } from "../../../../lib/cobro";
import { suscripcionDeCobro } from "../../../../lib/mercadopago";
import { sincronizarSuscripcion } from "../../../../lib/suscripciones";
import { sincronizarPago } from "../../../../lib/adelantos";

// Los avisos de Mercado Pago. Aquí no se cree nada del cuerpo: se comprueba la
// firma, se saca el id de la suscripción o del pago y se le pregunta a la
// pasarela cómo está. El aviso es un timbre, no el dato.
//
// Con una suscripción se contesta 200 en cuanto la firma pasa, incluso si
// sincronizar falla por algo nuestro: Mercado Pago reintenta lo que no recibe
// 200, y la suscripción se vuelve a sincronizar sola con su siguiente aviso. El
// error queda en los logs, que es donde se lee. Con un pago es al revés, y
// abajo se dice por qué.
export const dynamic = "force-dynamic";

export async function POST(request) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) {
    console.error("cobro: falta MP_WEBHOOK_SECRET; se rechaza el webhook");
    return new Response(null, { status: 503 });
  }

  const url = new URL(request.url);
  let aviso;
  try {
    aviso = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  // El id firmado es el de la query (`data.id`), que es el que Mercado Pago
  // usa en la plantilla; el del cuerpo es el mismo, pero manda el de la URL.
  const dataId = url.searchParams.get("data.id") ?? aviso?.data?.id ?? null;
  const valida = firmaValida({
    cabecera: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secreto,
  });
  if (!valida) return new Response(null, { status: 401 });

  const objetivo = idDeSuscripcionEnAviso(aviso);
  // Un `payment` es un pago por adelantado o el cargo de una suscripción;
  // `sincronizarPago` lee su referencia y deja pasar los segundos.
  const pago = objetivo ? null : idDePagoEnAviso(aviso);
  if (!objetivo && !pago) return Response.json({ ok: true, ignorado: true });

  // Un pago por adelantado es la excepción al 200 de siempre: el aviso de que
  // alguien pagó su ficha de OXXO es el único que llega —quien paga en la
  // tienda no vuelve al checkout—, y si se pierde, el dinero entró y el plan
  // no subió. Con un 500 Mercado Pago lo reintenta, y registrar el mismo pago
  // dos veces deja la base igual que una.
  if (pago) {
    try {
      await sincronizarPago(pago);
    } catch (error) {
      console.error("cobro: pago sin sincronizar; Mercado Pago lo reintentará", pago, error?.message);
      return new Response(null, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  try {
    const id =
      objetivo.clase === "cobro" ? await suscripcionDeCobro(objetivo.id) : objetivo.id;
    if (id) await sincronizarSuscripcion(id);
  } catch (error) {
    console.error("cobro: webhook sin sincronizar", objetivo, error?.message);
  }
  return Response.json({ ok: true });
}
