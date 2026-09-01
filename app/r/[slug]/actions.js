"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";

const MAX_TEXTO = 1500;

// El slug viaja en el formulario solo para saber a dónde volver y qué ruta
// revalidar. Quién puede escribir lo decide la RLS con el restaurant_id.
function rutaFicha(slug) {
  return `/r/${encodeURIComponent(slug)}`;
}

async function sesion(slug) {
  const supabase = await supabaseSession();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    redirect(`/entrar?next=${encodeURIComponent(rutaFicha(slug))}`);
  }
  return { supabase, user: data.user };
}

// La RLS es la que manda, pero devuelve un 42501 seco. Traducirlo aquí evita
// que la persona vea "no autorizado" sin saber qué hizo mal.
function mensajeDeRls(error) {
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return "No puedes reseñar este restaurante. Si es tuyo, las reseñas las escriben los comensales.";
  }
  if (error.code === "23514") {
    return `La reseña es demasiado larga. Máximo ${MAX_TEXTO} caracteres.`;
  }
  return null;
}

export async function guardarResena(_prevState, formData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const restaurantId = String(formData.get("restaurant_id") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const texto = String(formData.get("body") ?? "").trim();

  if (!slug || !restaurantId) {
    return { status: "error", message: "Recarga la página e inténtalo otra vez." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: "error", message: "Elige de una a cinco estrellas." };
  }
  if (texto.length > MAX_TEXTO) {
    return {
      status: "error",
      message: `La reseña es demasiado larga. Máximo ${MAX_TEXTO} caracteres.`,
    };
  }

  const { supabase, user } = await sesion(slug);

  // Upsert y no insert: la tabla tiene un único por (restaurante, autor), así
  // que volver a enviar el formulario corrige la reseña en vez de fallar.
  const { error } = await supabase.from("reviews").upsert(
    {
      restaurant_id: restaurantId,
      author_id: user.id,
      rating,
      body: texto || null,
    },
    { onConflict: "restaurant_id,author_id" },
  );

  if (error) {
    const traducido = mensajeDeRls(error);
    if (traducido) return { status: "error", message: traducido };
    console.error("guardar resena", error.message);
    return {
      status: "error",
      message: "No pudimos guardar tu reseña. Inténtalo otra vez.",
    };
  }

  revalidatePath(rutaFicha(slug));
  return { status: "ok", message: "Listo, tu reseña ya está publicada." };
}

export async function borrarResena(_prevState, formData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const restaurantId = String(formData.get("restaurant_id") ?? "").trim();

  if (!slug || !restaurantId) {
    return { status: "error", message: "Recarga la página e inténtalo otra vez." };
  }

  const { supabase, user } = await sesion(slug);

  // El filtro por author_id no sustituye a la RLS, la acompaña: sin él la
  // consulta pediría borrar todas las reseñas del restaurante y la RLS se
  // limitaría a dejar pasar la propia, que es más borrado del que se pidió.
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("author_id", user.id);

  if (error) {
    console.error("borrar resena", error.message);
    return {
      status: "error",
      message: "No pudimos borrar tu reseña. Inténtalo otra vez.",
    };
  }

  revalidatePath(rutaFicha(slug));
  return { status: "ok", message: "Borramos tu reseña." };
}
