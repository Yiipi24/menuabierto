import { firmaValida, idDeSuscripcionEnAviso } from "../../../../lib/cobro";
import { suscripcionDeCobro } from "../../../../lib/mercadopago";
import { sincronizarSuscripcion } from "../../../../lib/suscripciones";

// Los avisos de Mercado Pago. Aquí no se cree nada del cuerpo: se comprueba la
// firma, se saca el id de la suscripción y se le pregunta a la pasarela cómo
// está. El aviso es un timbre, no el dato.
//
// Se contesta 200 en cuanto la firma pasa, incluso si sincronizar falla por
// algo nuestro: Mercado Pago reintenta lo que no recibe 200, y un fallo de
// nuestra base no debería convertirse en una ráfaga de reintentos. El error
// queda en los logs, que es donde se lee.
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
  if (!objetivo) return Response.json({ ok: true, ignorado: true });

  try {
    const id =
      objetivo.clase === "cobro" ? await suscripcionDeCobro(objetivo.id) : objetivo.id;
    if (id) await sincronizarSuscripcion(id);
  } catch (error) {
    console.error("cobro: webhook sin sincronizar", objetivo, error?.message);
  }
  return Response.json({ ok: true });
}
