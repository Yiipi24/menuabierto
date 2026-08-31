"use server";

import { revalidatePath } from "next/cache";
import { supabaseSession } from "../../../lib/supabase";

const MINIMO = 10;

export async function guardarContrasena(_prevState, formData) {
  const password = String(formData.get("password") ?? "");
  const repetir = String(formData.get("password2") ?? "");

  // Diez caracteres, no ocho con mayúscula y símbolo. Las reglas de
  // composición empujan a la gente a "Passw0rd!"; la longitud es lo que de
  // verdad encarece adivinar.
  if (password.length < MINIMO) {
    return {
      status: "error",
      message: `La contraseña necesita al menos ${MINIMO} caracteres.`,
    };
  }
  if (password !== repetir) {
    return { status: "error", message: "Las dos contraseñas no coinciden." };
  }

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { status: "error", message: "Tu sesión expiró. Vuelve a entrar." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("update password", error.message);
    // Supabase rechaza contraseñas filtradas cuando la protección está activa.
    if (/leaked|pwned|compromis/i.test(error.message)) {
      return {
        status: "error",
        message:
          "Esa contraseña apareció en filtraciones conocidas. Elige otra.",
      };
    }
    return {
      status: "error",
      message: "No pudimos guardar la contraseña. Inténtalo otra vez.",
    };
  }

  revalidatePath("/panel/cuenta");
  return { status: "ok", message: "Contraseña guardada." };
}
