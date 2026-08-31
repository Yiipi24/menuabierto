"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INTENCIONES = new Set(["comensal", "restaurante"]);
const MINIMO = 10;

export async function registrar(_prevState, formData) {
  const nombre = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const trap = String(formData.get("company") ?? "").trim();

  if (nombre.length < 2) {
    return { status: "error", message: "Dinos cómo te llamas." };
  }
  if (!EMAIL.test(email) || email.length > 254) {
    return { status: "error", message: "Ese correo no se ve bien." };
  }
  // Diez caracteres y ninguna regla de composición: exigir mayúscula, número
  // y símbolo empuja a la gente hacia "Passw0rd!", que es corta y adivinable.
  if (password.length < MINIMO) {
    return {
      status: "error",
      message: `La contraseña necesita al menos ${MINIMO} caracteres.`,
    };
  }
  if (!INTENCIONES.has(intent)) {
    return { status: "error", message: "Elige una de las dos opciones." };
  }
  if (trap) {
    return { status: "sent", message: "" };
  }

  const host = (await headers()).get("origin") ?? "https://menuabierto.com";
  const destino = intent === "restaurante" ? "/panel/nuevo" : "/";
  const supabase = await supabaseSession();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${host}/auth/callback?next=${encodeURIComponent(destino)}`,
      data: { full_name: nombre, signup_intent: intent },
    },
  });

  if (error) {
    console.error("registro", error.message);
    if (error.status === 429) {
      return {
        status: "error",
        message: "Demasiados intentos seguidos. Espera un minuto.",
      };
    }
    if (/leaked|pwned|compromis/i.test(error.message)) {
      return {
        status: "error",
        message: "Esa contraseña apareció en filtraciones conocidas. Elige otra.",
      };
    }
    return {
      status: "error",
      message: "No pudimos crear la cuenta. Inténtalo otra vez.",
    };
  }

  // Con confirmación de correo activada, Supabase devuelve un usuario sin
  // sesión. Si algún día se desactiva, la sesión llega aquí y entramos ya.
  if (data.session) {
    redirect(destino);
  }

  return { status: "sent", message: "" };
}
