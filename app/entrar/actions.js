"use server";

import { redirect } from "next/navigation";
import { supabaseSession } from "../../lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Solo rutas internas: un destino con host ajeno convertiria el inicio de
// sesion en un puente hacia sitios de phishing con la marca de Menu Abierto.
function destinoSeguro(valor) {
  const v = String(valor ?? "");
  return v.startsWith("/") && !v.startsWith("//") ? v : "/panel";
}

export async function signInWithPassword(_prevState, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = destinoSeguro(formData.get("next"));

  if (!EMAIL.test(email) || !password) {
    return { status: "error", message: "Revisa tu correo y tu contraseña." };
  }

  const supabase = await supabaseSession();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("password sign-in failed", error.message);
    if (error.status === 429) {
      return {
        status: "error",
        message: "Demasiados intentos seguidos. Espera un minuto.",
      };
    }
    // Un mensaje unico para "no existe la cuenta" y "contrasena incorrecta":
    // distinguirlos le diria a un desconocido que correos estan registrados.
    return { status: "error", message: "Correo o contraseña incorrectos." };
  }

  redirect(next);
}
