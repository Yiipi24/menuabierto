"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Solo rutas internas: un destino con host ajeno convertiria el correo en un
// puente hacia sitios de phishing con la marca de Menu Abierto.
function destinoSeguro(valor) {
  const v = String(valor ?? "");
  return v.startsWith("/") && !v.startsWith("//") ? v : "/panel";
}

export async function requestMagicLink(_prevState, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const trap = String(formData.get("company") ?? "").trim();
  const next = destinoSeguro(formData.get("next"));

  if (!EMAIL.test(email) || email.length > 254) {
    return { status: "error", message: "Ese correo no se ve bien." };
  }
  if (trap) {
    return { status: "sent", message: "" };
  }

  const host = (await headers()).get("origin") ?? "https://menuabierto.com";
  const supabase = await supabaseSession();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${host}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("magic link failed", error.message);
    if (error.status === 429) {
      return {
        status: "error",
        message: "Demasiados intentos seguidos. Espera un minuto.",
      };
    }
    return {
      status: "error",
      message: "No pudimos enviar el enlace. Inténtalo otra vez.",
    };
  }

  return { status: "sent", message: "" };
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
    // Un mensaje único para "no existe la cuenta" y "contraseña incorrecta":
    // distinguirlos le diría a un desconocido qué correos están registrados.
    return {
      status: "error",
      message:
        "Correo o contraseña incorrectos. Si nunca creaste una contraseña, entra con el enlace.",
    };
  }

  redirect(next);
}
