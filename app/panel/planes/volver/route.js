import { NextResponse } from "next/server";
import { supabaseSession } from "../../../../lib/supabase";
import { sincronizarSuscripcion } from "../../../../lib/suscripciones";
import { cobroConfigurado } from "../../../../lib/mercadopago";

// A donde vuelve el dueño después de pagar. Mercado Pago agrega
// `preapproval_id` a la URL; con él se sincroniza el plan en el momento, sin
// esperar al webhook, para que al llegar a la página de planes ya vea el suyo.
//
// Solo sincroniza suscripciones de sus propias fichas: el id de la URL lo
// puede escribir cualquiera, y aunque sincronizar es inocuo —la verdad la pone
// la pasarela—, no hay por qué dejar que un desconocido dispare consultas.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("preapproval_id") ?? url.searchParams.get("id");
  const destino = new URL("/panel/planes", url.origin);

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.redirect(new URL("/entrar", url.origin));

  if (!id || !cobroConfigurado()) return NextResponse.redirect(destino);

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
  return NextResponse.redirect(destino);
}
