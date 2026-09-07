"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invalidarFicha, invalidarRutas } from "../../lib/cache";
import { supabaseSession } from "../../lib/supabase";

const BUCKET_FOTOS = "restaurantes";

const ESTADOS = ["borrador", "publicado", "oculto"];

// A dónde se vuelve al salir. Es una lista y no lo que traiga el formulario
// porque un destino libre convierte el botón de salir en una redirección
// abierta: cualquiera podría mandar a un usuario a otro sitio con un enlace.
const SALIDAS = ["/entrar", "/"];

export async function cerrarSesion(formData) {
  const supabase = await supabaseSession();
  await supabase.auth.signOut();
  // Del panel se sale a la puerta; del sitio público, a la portada, que es lo
  // que el comensal estaba mirando.
  const destino = String(formData?.get?.("destino") ?? "");
  redirect(SALIDAS.includes(destino) ? destino : "/entrar");
}

export async function crearRestaurante(_prevState, formData) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const nombre = String(formData.get("name") ?? "").trim();
  const ciudad = String(formData.get("city") ?? "").trim();
  const colonia = String(formData.get("neighborhood") ?? "").trim();
  const resumen = String(formData.get("summary") ?? "").trim();
  const nivel = Number(formData.get("price_level") ?? 2);
  const tipos = formData.getAll("cuisines").map(String).filter(Boolean);

  if (nombre.length < 2) {
    return { status: "error", message: "El nombre es obligatorio." };
  }
  if (ciudad.length < 2) {
    return { status: "error", message: "La ciudad es obligatoria." };
  }
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 4) {
    return { status: "error", message: "Elige un rango de precio." };
  }

  // La dirección la reparte la base y no esta función: para saber si
  // "tacoselgordo" está libre hay que ver TODAS las fichas, y la RLS aquí solo
  // deja ver las publicadas. `slug_disponible` mira desde dentro y devuelve el
  // nombre pelado, el nombre con la colonia si el pelado ya está tomado, y
  // numerado solo si tampoco eso alcanza.
  const { data: slug, error: errorSlug } = await supabase.rpc("slug_disponible", {
    p_nombre: nombre,
    p_colonia: colonia || null,
  });

  if (errorSlug || !slug) {
    console.error("slug del restaurante", errorSlug?.message);
    return {
      status: "error",
      message: "No pudimos guardar el restaurante. Inténtalo otra vez.",
    };
  }

  const { data: creado, error } = await supabase
    .from("restaurants")
    .insert({
      slug,
      name: nombre,
      summary: resumen || null,
      city: ciudad,
      neighborhood: colonia || null,
      price_level: nivel,
      status: "borrador",
      owner_id: auth.user.id,
      created_by: auth.user.id,
      claimed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // 23505 es el índice único del slug: entre la consulta de arriba y este
    // insert alguien más se quedó con esa dirección. Es raro y se resuelve
    // solo repitiendo el alta, así que se dice en vez de enseñar el error de
    // la base.
    console.error("crear restaurante", error.message);
    return {
      status: "error",
      message:
        error.code === "23505"
          ? "Alguien acaba de registrar un restaurante con ese nombre. Inténtalo otra vez."
          : "No pudimos guardar el restaurante. Inténtalo otra vez.",
    };
  }

  if (tipos.length) {
    const { data: catalogo } = await supabase
      .from("cuisines")
      .select("id")
      .in("slug", tipos);

    if (catalogo?.length) {
      await supabase.from("restaurant_cuisines").insert(
        catalogo.map((c) => ({ restaurant_id: creado.id, cuisine_id: c.id })),
      );
    }
  }

  revalidatePath("/panel");
  // Directo a la ficha: recien creada le faltan telefono, horarios y fotos, y
  // volver a la lista deja al dueno sin ver donde cargarlos.
  redirect(`/panel/${creado.id}`);
}

// Publicar / ocultar. El estado lo manda el formulario porque el mismo botón
// sirve para los dos sentidos y así no hay que adivinar el actual.
export async function cambiarEstado(formData) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("status") ?? "");
  if (!ESTADOS.includes(estado)) return;

  // La RLS ya exige ser el dueño; el filtro explícito evita mandar un update
  // que no toca ninguna fila y deja clara la intención. El slug vuelve con el
  // update para no pedirlo en una segunda consulta: publicar u ocultar cambia
  // lo que ve todo el mundo y hay que tirar lo guardado.
  const { data: cambiado, error } = await supabase
    .from("restaurants")
    .update({ status: estado })
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .select("slug")
    .maybeSingle();

  if (error) console.error("cambiar estado", error.message);

  revalidatePath("/panel");

  // Publicar es lo más urgente que hace un dueño: la ficha tiene que existir
  // ya, y el sitemap tiene que anunciarla hoy y no dentro de una hora. Ocultar
  // corre la misma prisa en el otro sentido.
  if (cambiado?.slug) {
    invalidarFicha(cambiado.slug);
    invalidarRutas();
  }
}

export async function borrarRestaurante(formData) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const id = String(formData.get("id") ?? "");

  // El slug se lee antes del borrado: después ya no hay fila de donde sacarlo,
  // y sin él lo guardado de esa ficha se quedaría en pie hasta que caducara.
  const { data: victima } = await supabase
    .from("restaurants")
    .select("slug")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  // Las fotos viven en Storage y no se van solas con la fila: hay que
  // borrarlas antes de perder la lista de rutas.
  const { data: fotos } = await supabase
    .from("restaurant_media")
    .select("storage_path")
    .eq("restaurant_id", id);

  if (fotos?.length) {
    await supabase.storage
      .from(BUCKET_FOTOS)
      .remove(fotos.map((f) => f.storage_path));
  }

  const { error } = await supabase
    .from("restaurants")
    .delete()
    .eq("id", id)
    .eq("owner_id", auth.user.id);

  if (error) console.error("borrar restaurante", error.message);

  revalidatePath("/panel");
  if (victima?.slug) {
    invalidarFicha(victima.slug);
    invalidarRutas();
  }
  redirect("/panel");
}
