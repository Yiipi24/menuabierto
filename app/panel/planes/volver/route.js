import { NextResponse } from "next/server";
import { supabaseSession } from "../../../../lib/supabase";
import { sincronizarSuscripcion } from "../../../../lib/suscripciones";
import { sincronizarPago } from "../../../../lib/adelantos";
import { cobroConfigurado } from "../../../../lib/mercadopago";
import { leerReferenciaDeAdelanto } from "../../../../lib/cobro";

// A donde vuelve el dueño después de pagar. Mercado Pago agrega a la URL
// `preapproval_id` si contrató una suscripción, o `payment_id` y
// `external_reference` si pagó por adelantado. Con eso se sincroniza en el
// momento, sin esperar al webhook, para que al llegar a la página de planes
// ya vea el suyo.
//
// Solo sincroniza lo de sus propias fichas: el id de la URL lo puede escribir
// cualquiera, y aunque sincronizar es inocuo —la verdad la pone la pasarela—,
// no hay por qué dejar que un desconocido dispare consultas.
export const dynamic = "force-dynamic";

// Lo que dice la página según en qué quedó un pago por adelantado.
function avisoDePago(status) {
  if (status === "approved") return "adelanto-activo";
  if (["pending", "in_process", "authorized"].includes(status)) return "adelanto-pendiente";
  return "adelanto-rechazado";
}

async function volverDeSuscripcion(supabase, id, destino) {
  const { data: propia } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("provider_id", id)
    .maybeSingle();

  try {
    if (propia) {
      const resultado = await sincronizarSuscripcion(id);
      destino.searchParams.set(
        "aviso",
        resultado?.estado?.status === "authorized" ? "activo" : "pendiente",
      );
    }
  } catch (error) {
    console.error("cobro: no se pudo sincronizar al volver", error?.message);
    destino.searchParams.set("aviso", "pendiente");
  }
}

async function volverDePago(supabase, usuarioId, url, destino) {
  const id = url.searchParams.get("payment_id") ?? url.searchParams.get("collection_id");
  // Quien cierra el checkout sin pagar vuelve con `payment_id=null`.
  if (!/^[0-9]{1,30}$/.test(id ?? "")) return;

  // La referencia de la URL solo sirve para saber de qué ficha dice ser el
  // pago y comprobar que es suya; lo que se escribe sale de la pasarela.
  const referencia = leerReferenciaDeAdelanto(url.searchParams.get("external_reference"));
  if (!referencia) return;
  const { data: propia } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", referencia.restauranteId)
    .eq("owner_id", usuarioId)
    .maybeSingle();
  if (!propia) return;

  try {
    const resultado = await sincronizarPago(id, { restauranteEsperado: propia.id });
    if (resultado) destino.searchParams.set("aviso", avisoDePago(resultado.resultado?.status));
  } catch (error) {
    // El webhook lo vuelve a intentar; aquí basta con no prometer nada.
    console.error("cobro: no se pudo sincronizar el pago al volver", error?.message);
    destino.searchParams.set("aviso", "adelanto-pendiente");
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const destino = new URL("/panel/planes", url.origin);

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.redirect(new URL("/entrar", url.origin));

  if (!cobroConfigurado()) return NextResponse.redirect(destino);

  const suscripcion = url.searchParams.get("preapproval_id") ?? url.searchParams.get("id");
  if (suscripcion) {
    await volverDeSuscripcion(supabase, suscripcion, destino);
  } else {
    await volverDePago(supabase, auth.user.id, url, destino);
  }
  return NextResponse.redirect(destino);
}
