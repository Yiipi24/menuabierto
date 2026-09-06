import { NextResponse } from "next/server";
import { destinoTrasEntrar } from "../../../lib/destino";
import { rutaInterna } from "../../../lib/rutas";
import { supabaseSession } from "../../../lib/supabase";

// Destino del enlace del correo. Cambia el código de un solo uso por una
// sesión en cookies y manda a la persona a donde pidió el enlace.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Si el enlace del correo llega sin destino, lo decide destinoTrasEntrar:
  // mandar al panel a un comensal lo deja en el alta de un restaurante suyo.
  const next = searchParams.get("next") ?? "";

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?error=sin-codigo`);
  }

  const supabase = await supabaseSession();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("code exchange failed", error.message);
    return NextResponse.redirect(`${origin}/entrar?error=enlace-invalido`);
  }

  const destino = next
    ? rutaInterna(next, "/")
    : await destinoTrasEntrar(data.user);

  return NextResponse.redirect(`${origin}${destino}`);
}
