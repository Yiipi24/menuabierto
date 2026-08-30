"use server";

import { headers } from "next/headers";
import { supabaseSession } from "../../lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function requestMagicLink(_prevState, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const trap = String(formData.get("company") ?? "").trim();

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
      emailRedirectTo: `${host}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("magic link failed", error.message);
    // Los límites de envío responden 429; conviene decirlo en vez de dejar a
    // la persona reintentando contra una pared.
    if (error.status === 429) {
      return {
        status: "error",
        message: "Demasiados intentos seguidos. Espera unos minutos.",
      };
    }
    return {
      status: "error",
      message: "No pudimos enviar el enlace. Inténtalo otra vez.",
    };
  }

  return { status: "sent", message: "" };
}
