import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { supabaseServer } from "../../../lib/supabase";
import {
  COOKIE_VISITANTE,
  DIAS_COOKIE,
  eventoValido,
  fuenteValida,
} from "../../../lib/eventos";
import { menuIdValido } from "../../../lib/slug";

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

function coordenada(valor, tope) {
  const n = Number(valor);
  return Number.isFinite(n) && Math.abs(n) <= tope ? n : null;
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
  // La carta solo viaja desde la página de una sola: es lo que separa "vieron
  // el menú" de "vieron el de bebidas". Un id con mala forma se descarta en
  // vez de tumbar el evento: el escaneo sigue contando aunque no se sepa de
  // qué carta.
  const menu = menuIdValido(cuerpo?.menu) ? String(cuerpo.menu) : null;

  if (!slug || !eventoValido(evento)) return new Response(null, { status: 400 });

  const galletas = await cookies();
  let visitante = galletas.get(COOKIE_VISITANTE)?.value;
  const nuevaCookie = !visitante || visitante.length < 8 || visitante.length > 64;
  if (nuevaCookie) visitante = randomUUID();

  const h = await headers();
  const ciudad = limpio(h.get("x-vercel-ip-city"));
  const estado = limpio(h.get("x-vercel-ip-country-region"));
  const pais = (h.get("x-vercel-ip-country") || "").slice(0, 2).toUpperCase() || null;
  // El mismo borde que dice la ciudad manda su punto aproximado. Con él, el
  // panel puede pintar un mapa sin geocodificar nada después.
  const lat = coordenada(h.get("x-vercel-ip-latitude"), 90);
  const lng = coordenada(h.get("x-vercel-ip-longitude"), 180);

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

  // La carta tiene que ser de esta ficha y estar visible. Lo vuelve a
  // comprobar la política de la tabla; aquí se filtra antes para que un id de
  // otro restaurante no convierta el evento entero en un error de RLS y se
  // pierda la visita.
  let menuId = null;
  if (ficha?.id && menu) {
    const { data: carta } = await supabase
      .from("menus")
      .select("id")
      .eq("id", menu)
      .eq("restaurant_id", ficha.id)
      .eq("is_visible", true)
      .maybeSingle();
    menuId = carta?.id ?? null;
  }

  if (ficha?.id) {
    const { error } = await supabase.from("restaurant_events").insert({
      restaurant_id: ficha.id,
      menu_id: menuId,
      event: evento,
      source: fuente,
      city: ciudad,
      region: estado,
      country: pais,
      lat,
      lng,
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
