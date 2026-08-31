"use server";

import { headers } from "next/headers";
import { supabaseSession } from "../../lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function pedirRecuperacion(_prevState, formData) {
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

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Aterriza directo donde se cambia la contrasena, con sesion ya abierta.
    redirectTo: `${host}/auth/callback?next=/panel/cuenta`,
  });

  if (error) {
    console.error("reset password", error.message);
    if (error.status === 429) {
      return {
        status: "error",
        message: "Demasiados intentos seguidos. Espera un minuto.",
      };
    }
  }

  // Siempre respondemos igual, haya cuenta o no. Decir "ese correo no existe"
  // convertiria esta pantalla en un detector de cuentas registradas.
  return { status: "sent", message: "" };
}
