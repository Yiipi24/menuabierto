"use server";

import { revalidatePath } from "next/cache";
import { supabaseSession } from "../../../lib/supabase";
import { BUCKET_AVATARES } from "../../../lib/avatar";
import { MAX_AVATAR_BYTES, TIPOS_FOTO } from "../../../lib/subidas";

const MINIMO = 10;

// La foto de la cuenta sale en el menú de todas las páginas, así que al
// cambiarla hay que rehacer el árbol entero y no solo esta pantalla.
function refrescarTodo() {
  revalidatePath("/", "layout");
}

// El archivo viejo se borra después de apuntar el nuevo: si el borrado falla,
// lo que queda es un archivo huérfano en el bucket y no un perfil apuntando a
// algo que ya no existe.
async function borrarAnterior(supabase, ruta) {
  if (!ruta) return;
  const { error } = await supabase.storage.from(BUCKET_AVATARES).remove([ruta]);
  if (error) console.error("borrar avatar viejo", error.message);
}

export async function subirFotoDeCuenta(_prevState, formData) {
  const archivo = formData.get("foto");
  if (!archivo || typeof archivo !== "object" || archivo.size === 0) {
    return { status: "error", message: "Elige una imagen." };
  }
  if (!TIPOS_FOTO.includes(archivo.type)) {
    return { status: "error", message: "Solo JPG, PNG, WebP o AVIF." };
  }
  if (archivo.size > MAX_AVATAR_BYTES) {
    return { status: "error", message: "La foto debe pesar menos de 2 MB." };
  }

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { status: "error", message: "Tu sesión expiró. Vuelve a entrar." };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", auth.user.id)
    .maybeSingle();

  // La primera carpeta de la ruta es el id de la persona: de ahí saca el
  // permiso la política de Storage. El nombre es nuevo cada vez para que las
  // cachés del navegador y del CDN no sigan enseñando la foto anterior.
  const extension = archivo.type.split("/")[1].replace("jpeg", "jpg");
  const ruta = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_AVATARES)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (errorSubida) {
    console.error("subir avatar", errorSubida.message);
    return { status: "error", message: "No pudimos subir la foto. Inténtalo otra vez." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: ruta })
    .eq("id", auth.user.id);

  if (error) {
    console.error("guardar avatar", error.message);
    // El archivo sin fila que lo apunte sería basura invisible en el bucket.
    await supabase.storage.from(BUCKET_AVATARES).remove([ruta]);
    return { status: "error", message: "No pudimos guardar la foto." };
  }

  await borrarAnterior(supabase, perfil?.avatar_path);
  refrescarTodo();
  return { status: "ok", message: "Lista: esa es tu foto." };
}

export async function quitarFotoDeCuenta() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { status: "error", message: "Tu sesión expiró. Vuelve a entrar." };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", auth.user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", auth.user.id);

  if (error) {
    console.error("quitar avatar", error.message);
    return { status: "error", message: "No pudimos quitar la foto." };
  }

  await borrarAnterior(supabase, perfil?.avatar_path);
  refrescarTodo();
  return { status: "ok", message: "Volviste al icono de siempre." };
}

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
