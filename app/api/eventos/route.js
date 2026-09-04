import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "../../../lib/supabase";
import {
  COOKIE_VISITANTE,
  DIAS_COOKIE,
  eventoValido,
  fuenteValida,
} from "../../../lib/eventos";

// Aquí aterrizan los eventos de las fichas públicas. Va por el servidor y no
// directo a Supabase desde el navegador por tres razones: la ciudad la sabe el
// borde de Vercel y no la página, el identificador del visitante tiene que
// vivir en una cookie httpOnly que el JavaScript no pueda tocar, y así la
// llave de Supabase no anda suelta en el cliente.

export const dynamic = "force-dynamic";

// Vercel manda la ciudad con escape de URL ("Gral.%20Escobedo").
function limpio(valor) {
  if (!valor) return null;
  try {
    return decodeURIComponent(valor).trim().slice(0, 80) || null;
  } catch {
    return valor.trim().slice(0, 80) || null;
  }
}

export async function POST(request) {
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const slug = String(cuerpo?.slug ?? "").slice(0, 80);
  const evento = String(cuerpo?.evento ?? "");
  const fuente = fuenteValida(String(cuerpo?.fuente ?? "directo"));

  if (!slug || !eventoValido(evento)) return new Response(null, { status: 400 });

  const galletas = await cookies();
  let visitante = galletas.get(COOKIE_VISITANTE)?.value;
  const nuevaCookie = !visitante || visitante.length < 8 || visitante.length > 64;
  if (nuevaCookie) visitante = randomUUID();

  const h = await headers();
  const ciudad = limpio(h.get("x-vercel-ip-city"));
  const estado = limpio(h.get("x-vercel-ip-country-region"));
  const pais = (h.get("x-vercel-ip-country") || "").slice(0, 2).toUpperCase() || null;

  const supabase = supabaseServer();

  // La ficha se busca por slug y solo si está publicada: es la misma
  // condición que deja pasar la política de la tabla, y así un borrador no
  // acumula eventos.
  const { data: ficha } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .eq("status", "publicado")
    .maybeSingle();

  if (ficha?.id) {
    const { error } = await supabase.from("restaurant_events").insert({
      restaurant_id: ficha.id,
      event: evento,
      source: fuente,
      city: ciudad,
      region: estado,
      country: pais,
      visitor: visitante,
    });

    // 23505 es el índice que evita contar diez veces a quien recarga: que
    // choque es exactamente lo que queremos, no un error que reportar.
    if (error && error.code !== "23505") {
      console.error("evento", error.message);
    }
  }

  if (nuevaCookie) {
    galletas.set(COOKIE_VISITANTE, visitante, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DIAS_COOKIE * 24 * 60 * 60,
    });
  }

  return new Response(null, { status: 204 });
}
