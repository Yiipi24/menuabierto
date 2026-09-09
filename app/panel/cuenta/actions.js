"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseSession } from "../../../lib/supabase";
import { prefsParaGuardar, suscripcionValida } from "../../../lib/avisos";
import { urlAbsoluta } from "../../../lib/url";
import { esProveedorApagado, redDeProveedor } from "../../../lib/redes-cuenta";
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

// ---------- las redes vinculadas a la cuenta ----------
//
// El navegador nunca ve la llave de Supabase ni los tokens —toda la sesión vive
// en cookies httpOnly—, así que el vaivén del OAuth se arma aquí: se le pide a
// Supabase la dirección del proveedor con `skipBrowserRedirect` y se manda a la
// persona a ella. Vuelve por /auth/callback, que ya sabe cambiar el código por
// sesión, y la identidad queda pegada a la cuenta que ya tenía.

// Las identidades que la persona ya vinculó. Se leen del usuario firmado, que
// es la única fuente: no hay tabla nuestra que copiar ni que mantener al día.
export async function redesDeLaCuenta() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return [];

  return (auth.user.identities ?? []).map((i) => ({
    id: i.identity_id ?? i.id,
    proveedor: i.provider,
    cuenta:
      i.identity_data?.email ??
      i.identity_data?.user_name ??
      i.identity_data?.name ??
      null,
  }));
}

export async function vincularRed(_prevState, formData) {
  const proveedor = String(formData.get("proveedor") ?? "");
  const red = redDeProveedor(proveedor);
  if (!red) return { status: "error", message: "Esa red no se puede vincular." };

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { status: "error", message: "Tu sesión expiró. Vuelve a entrar." };
  }

  const destino = await urlAbsoluta("/auth/callback?next=%2Fpanel%2Fcuenta");

  const { data, error } = await supabase.auth.linkIdentity({
    provider: red.proveedor,
    options: { redirectTo: destino, skipBrowserRedirect: true },
  });

  if (error || !data?.url) {
    console.error("vincular red", error?.message);
    if (esProveedorApagado(error?.message)) {
      return {
        status: "error",
        message: `Falta encender ${red.nombre} en Supabase (Authentication → Providers) con su client ID y su secret.`,
      };
    }
    if (/manual linking|not enabled/i.test(String(error?.message))) {
      return {
        status: "error",
        message:
          "Falta permitir vincular cuentas en Supabase (Authentication → Manual Linking).",
      };
    }
    return {
      status: "error",
      message: `No pudimos empezar la conexión con ${red.nombre}. Inténtalo otra vez.`,
    };
  }

  // Salir del sitio es lo último que hace la acción: si algo falla antes, la
  // persona se queda en su cuenta con un mensaje y no a medio camino.
  redirect(data.url);
}

export async function desvincularRed(_prevState, formData) {
  const identidad = String(formData.get("identidad") ?? "");
  if (!identidad) return { status: "error", message: "Recarga la página e inténtalo otra vez." };

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { status: "error", message: "Tu sesión expiró. Vuelve a entrar." };
  }

  const identidades = auth.user.identities ?? [];
  const cual = identidades.find((i) => (i.identity_id ?? i.id) === identidad);
  if (!cual) return { status: "error", message: "Esa red ya no está vinculada." };

  // Quitar la última forma de entrar dejaría a la persona fuera de su propia
  // cuenta. Supabase lo rechaza, pero decirlo antes evita el error seco.
  if (identidades.length <= 1) {
    return {
      status: "error",
      message:
        "Es tu única forma de entrar. Ponle una contraseña a tu cuenta antes de desvincularla.",
    };
  }

  const { error } = await supabase.auth.unlinkIdentity(cual);

  if (error) {
    console.error("desvincular red", error.message);
    return { status: "error", message: "No pudimos desvincularla. Inténtalo otra vez." };
  }

  revalidatePath("/panel/cuenta");
  const red = redDeProveedor(cual.provider);
  return { status: "ok", message: `${red?.nombre ?? "La red"} ya no está vinculada.` };
}

/* ---------- avisos por push ---------- */

export async function guardarSuscripcionPush(cruda) {
  let sub = null;
  try {
    sub = suscripcionValida(JSON.parse(String(cruda ?? "")));
  } catch {
    sub = null;
  }
  if (!sub) return { status: "error", message: "La suscripción llegó con mala forma." };

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { status: "error", message: "Tu sesión expiró. Vuelve a entrar." };

  const agente = String((await headers()).get("user-agent") ?? "").slice(0, 300) || null;
  // Un endpoint que ya estaba (otra cuenta en el mismo navegador, o una
  // recarga) se reasigna a quien está firmado: es su navegador ahora.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { profile_id: auth.user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, user_agent: agente },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.error("guardar suscripcion push", error.message);
    return { status: "error", message: "No pudimos guardar la suscripción." };
  }
  return { status: "ok" };
}

export async function borrarSuscripcionPush(endpoint) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { status: "error", message: "Tu sesión expiró." };
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("profile_id", auth.user.id)
    .eq("endpoint", String(endpoint ?? ""));
  if (error) {
    console.error("borrar suscripcion push", error.message);
    return { status: "error", message: "No pudimos darte de baja." };
  }
  return { status: "ok" };
}

export async function guardarPreferenciasPush(crudas) {
  let prefs;
  try {
    prefs = prefsParaGuardar(JSON.parse(String(crudas ?? "")));
  } catch {
    return { status: "error", message: "Las preferencias llegaron con mala forma." };
  }
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { status: "error", message: "Tu sesión expiró." };
  const { error } = await supabase.from("profiles").update({ push_prefs: prefs }).eq("id", auth.user.id);
  if (error) {
    console.error("guardar preferencias push", error.message);
    return { status: "error", message: "No pudimos guardar tus preferencias." };
  }
  revalidatePath("/panel/cuenta");
  return { status: "ok" };
}
