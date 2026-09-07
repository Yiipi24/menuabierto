"use server";

import { revalidatePath } from "next/cache";
import { invalidarFicha } from "../../../lib/cache";
import { supabaseSession } from "../../../lib/supabase";
import {
  BUCKET_SOCIAL,
  MAX_TEXTO_POST,
  extensionDeMime,
  mediaDeMime,
  revisarMedia,
} from "../../../lib/social";

// Publicar, editar y borrar. Del lado del dueño.
//
// La regla que sostiene todo esto —solo puedes publicar en restaurantes
// tuyos— la impone la política de `social_post_restaurants`, que exige ser el
// autor del contenido *y* el dueño de la ficha. Aquí se vuelve a comprobar
// antes de escribir nada: no porque la RLS no baste, sino porque un error
// entendible ("ese restaurante ya no es tuyo") vale más que un 42501 seco a
// mitad de una subida de diez megas.

async function sesion() {
  const supabase = await supabaseSession();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null };
}

// Los restaurantes del dueño, que son las casillas del formulario.
export async function misRestaurantes() {
  const { supabase, user } = await sesion();
  if (!user) return [];

  const { data } = await supabase
    .from("restaurants")
    .select("id, name, slug, city, neighborhood, status")
    .eq("owner_id", user.id)
    .order("name");

  return data ?? [];
}

// Lo que ya publicó, con sus números. Por RPC porque cruza el contenido con
// sus restaurantes y con los tres conteos.
export async function misPublicaciones(antes = null) {
  const { supabase, user } = await sesion();
  if (!user) return [];

  const { data, error } = await supabase.rpc("social_mias", { limite: 30, antes });
  if (error) {
    console.error("mis publicaciones", error.message);
    return [];
  }

  return (data ?? []).map((p) => ({
    ...p,
    url: supabase.storage.from(BUCKET_SOCIAL).getPublicUrl(p.media_path).data.publicUrl,
  }));
}

// Las cuentas de redes sociales conectadas para publicar fuera de Menú Abierto.
//
// Hoy devuelve la lista vacía siempre, y eso no es un pendiente escondido: no
// existe el OAuth de Meta, TikTok ni X, así que ninguna cuenta puede estar
// conectada y decir lo contrario sería inventar. Queda como acción de servidor
// —y no como una constante en el cliente— porque es el sitio donde se leerá la
// tabla de conexiones el día que las integraciones estén aprobadas, sin tocar
// la pantalla.
export async function conexionesDeRedes() {
  const { user } = await sesion();
  if (!user) return [];
  return [];
}

function fallo(message) {
  return { status: "error", message };
}

export async function publicar(_prevState, formData) {
  const { supabase, user } = await sesion();
  if (!user) return fallo("Tu sesión expiró. Entra otra vez.");

  const tipo = String(formData.get("kind") ?? "");
  if (tipo !== "historia" && tipo !== "publicacion") {
    return fallo("Elige si es una historia o una publicación.");
  }

  const texto = String(formData.get("body") ?? "").trim();
  if (texto.length > MAX_TEXTO_POST) {
    return fallo(`El texto es demasiado largo. Máximo ${MAX_TEXTO_POST} caracteres.`);
  }

  const elegidos = formData.getAll("restaurantes").map(String).filter(Boolean);
  if (!elegidos.length) {
    return fallo("Elige al menos un restaurante donde publicarlo.");
  }

  const archivo = formData.get("media");
  const aviso = revisarMedia(archivo);
  if (aviso) return fallo(aviso);

  // Que los restaurantes elegidos sean suyos, y que estén publicados: una
  // historia en una ficha en borrador no la vería nadie, ni siquiera quien la
  // sigue, y publicarla en silencio sería mentirle al dueño.
  const { data: propios } = await supabase
    .from("restaurants")
    .select("id, status")
    .eq("owner_id", user.id)
    .in("id", elegidos);

  const validos = (propios ?? []).map((r) => r.id);
  if (validos.length !== elegidos.length) {
    return fallo("Uno de los restaurantes que elegiste ya no es tuyo. Recarga la página.");
  }

  const borradores = (propios ?? []).filter((r) => r.status !== "publicado");

  // El archivo va al bucket antes que la fila: si la subida falla, no queda
  // una publicación apuntando a un archivo que no existe. Al revés sí puede
  // quedar un archivo huérfano, que es basura callada y no una ficha rota.
  const extension = extensionDeMime(archivo.type);
  const ruta = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_SOCIAL)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (errorSubida) {
    console.error("subir media", errorSubida.message);
    return fallo("No pudimos subir el archivo. Inténtalo otra vez.");
  }

  const { data: post, error: errorPost } = await supabase
    .from("social_posts")
    .insert({
      author_id: user.id,
      kind: tipo,
      body: texto || null,
      media_path: ruta,
      media_mime: archivo.type,
      media_kind: mediaDeMime(archivo.type),
    })
    .select("id")
    .single();

  if (errorPost) {
    console.error("crear post", errorPost.message);
    await supabase.storage.from(BUCKET_SOCIAL).remove([ruta]);
    return fallo("No pudimos publicar. Inténtalo otra vez.");
  }

  const { error: errorVinculo } = await supabase
    .from("social_post_restaurants")
    .insert(validos.map((id) => ({ post_id: post.id, restaurant_id: id })));

  if (errorVinculo) {
    console.error("vincular post", errorVinculo.message);
    // Sin restaurantes no se ve en ninguna parte, así que se deshace entero:
    // el borrado en cascada se lleva la fila y aquí se limpia el archivo.
    await supabase.from("social_posts").delete().eq("id", post.id);
    await supabase.storage.from(BUCKET_SOCIAL).remove([ruta]);
    return fallo("No pudimos publicarlo en tus restaurantes. Inténtalo otra vez.");
  }

  revalidatePath("/panel/publicaciones");
  await revalidarFichas(supabase, validos);

  const cuantos = validos.length;
  const donde = cuantos === 1 ? "tu restaurante" : `tus ${cuantos} restaurantes`;

  if (borradores.length) {
    return {
      status: "ok",
      message: `Listo, se publicó en ${donde}. Ojo: ${
        borradores.length === 1 ? "uno está" : `${borradores.length} están`
      } en borrador, así que ahí no se ve hasta que publiques la ficha.`,
    };
  }

  return {
    status: "ok",
    message:
      tipo === "historia"
        ? `Tu historia ya está en ${donde}. Se ve durante 24 horas.`
        : `Tu publicación ya está en ${donde}.`,
  };
}

export async function editarTexto(_prevState, formData) {
  const { supabase, user } = await sesion();
  if (!user) return fallo("Tu sesión expiró. Entra otra vez.");

  const id = String(formData.get("id") ?? "");
  const texto = String(formData.get("body") ?? "").trim();
  if (!id) return fallo("Recarga la página e inténtalo otra vez.");
  if (texto.length > MAX_TEXTO_POST) {
    return fallo(`El texto es demasiado largo. Máximo ${MAX_TEXTO_POST} caracteres.`);
  }

  // El filtro por autor acompaña a la RLS, no la sustituye: sin él la consulta
  // pediría editar cualquier fila y la política se limitaría a dejar pasar la
  // propia, que es más edición de la que se pidió.
  const { error } = await supabase
    .from("social_posts")
    .update({ body: texto || null })
    .eq("id", id)
    .eq("author_id", user.id);

  if (error) {
    console.error("editar post", error.message);
    return fallo("No pudimos guardar el cambio. Inténtalo otra vez.");
  }

  const { data: fichas } = await supabase
    .from("social_post_restaurants")
    .select("restaurant_id")
    .eq("post_id", id);

  revalidatePath("/panel/publicaciones");
  await revalidarFichas(supabase, (fichas ?? []).map((f) => f.restaurant_id));

  return { status: "ok", message: "Guardado." };
}

export async function borrar(_prevState, formData) {
  const { supabase, user } = await sesion();
  if (!user) return fallo("Tu sesión expiró. Entra otra vez.");

  const id = String(formData.get("id") ?? "");
  if (!id) return fallo("Recarga la página e inténtalo otra vez.");

  // Las fichas y el archivo se leen antes del borrado: después ya no están,
  // porque la cascada se lleva los vínculos con la fila.
  const [{ data: fichas }, { data: post }] = await Promise.all([
    supabase.from("social_post_restaurants").select("restaurant_id").eq("post_id", id),
    supabase.from("social_posts").select("media_path").eq("id", id).maybeSingle(),
  ]);

  const { error } = await supabase
    .from("social_posts")
    .delete()
    .eq("id", id)
    .eq("author_id", user.id);

  if (error) {
    console.error("borrar post", error.message);
    return fallo("No pudimos borrarlo. Inténtalo otra vez.");
  }

  // El archivo se va detrás de la fila. Si esto falla queda un archivo suelto
  // en el bucket, que es basura callada y no una publicación rota.
  if (post?.media_path) {
    await supabase.storage.from(BUCKET_SOCIAL).remove([post.media_path]);
  }

  revalidatePath("/panel/publicaciones");
  await revalidarFichas(supabase, (fichas ?? []).map((f) => f.restaurant_id));

  return { status: "ok", message: "Borrado." };
}

// Historias y publicaciones no viajan en lo que la ficha tiene guardado —salen
// de `_social/datos`, que se lee en cada visita porque depende de quién mire—,
// pero tirar igual lo guardado de esas fichas no cuesta nada y evita tener que
// recordar cuál de las dos cargas trae qué. Son los slugs de los restaurantes
// que acaban de cambiar, no la lista entera.
async function revalidarFichas(supabase, ids) {
  if (!ids?.length) return;
  const { data } = await supabase.from("restaurants").select("slug").in("id", ids);
  for (const r of data ?? []) invalidarFicha(r.slug);
  revalidatePath("/novedades");
}
