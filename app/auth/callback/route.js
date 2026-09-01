import { NextResponse } from "next/server";
import { rutaInterna } from "../../../lib/rutas";
import { supabaseSession } from "../../../lib/supabase";

// Destino del enlace del correo. Cambia el código de un solo uso por una
// sesión en cookies y manda a la persona al panel.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/panel";

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?error=sin-codigo`);
  }

  const supabase = await supabaseSession();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("code exchange failed", error.message);
    return NextResponse.redirect(`${origin}/entrar?error=enlace-invalido`);
  }

  return NextResponse.redirect(`${origin}${rutaInterna(next)}`);
}
