"use server";

import { revalidatePath } from "next/cache";
import { supabaseSession } from "../../lib/supabase";
import { MAX_TEXTO_COMENTARIO, POR_PAGINA } from "../../lib/social";

// Las acciones que puede disparar un comensal: seguir, la campana, el corazón
// y el comentario. Todas devuelven `{ ok, motivo }` en vez de lanzar, porque
// quien las llama es un botón que ya se pintó en su estado nuevo y lo único
// que necesita saber es si tiene que regresarse.
//
// `motivo: "sesion"` es el caso importante. Ninguna de estas acciones esconde
// su botón a quien no ha entrado: se le enseña, y al pulsarlo se le pide la
// cuenta con la acción todavía en la mano, para completarla en cuanto vuelva.
// Eso es lo que hace `siguiente`: la dirección a la que volver ya lleva escrito
// lo que la persona estaba haciendo.

async function conSesion() {
  const supabase = await supabaseSession();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

export async function alternarSeguir(restauranteId, seguir) {
  const { supabase, user } = await conSesion();
  if (!user) return { ok: false, motivo: "sesion" };

  if (seguir) {
    // Insert y no upsert: bajo RLS, resolver un conflicto exige poder leer la
    // fila en conflicto, y aquí la política de SELECT ya existe pero el insert
    // repetido no es un caso real —el botón enseña lo contrario de lo que hay—.
    // Un choque de dos pestañas se traga en silencio: el estado final es el
    // mismo que la persona pidió.
    const { error } = await supabase
      .from("restaurant_followers")
      .insert({ profile_id: user.id, restaurant_id: restauranteId });
    if (error && error.code !== "23505") {
      console.error("seguir", error.message);
      return { ok: false, motivo: "error" };
    }
  } else {
    const { error } = await supabase
      .from("restaurant_followers")
      .delete()
      .eq("profile_id", user.id)
      .eq("restaurant_id", restauranteId);
    if (error) {
      console.error("dejar de seguir", error.message);
      return { ok: false, motivo: "error" };
    }
  }

  return { ok: true };
}

// La campana. Es una preferencia del seguimiento, así que encenderla sin seguir
// no significa nada: si la persona la pulsa antes de seguir, se hace lo que
// quiso decir y se la deja siguiendo con la alerta puesta.
export async function alternarAlerta(restauranteId, encender) {
  const { supabase, user } = await conSesion();
  if (!user) return { ok: false, motivo: "sesion" };

  const { data: fila } = await supabase
    .from("restaurant_followers")
    .select("profile_id")
    .eq("profile_id", user.id)
    .eq("restaurant_id", restauranteId)
    .maybeSingle();

  if (!fila) {
    if (!encender) return { ok: true, sigue: false };
    const { error } = await supabase.from("restaurant_followers").insert({
      profile_id: user.id,
      restaurant_id: restauranteId,
      notify_stories: true,
    });
    if (error) {
      console.error("alerta al seguir", error.message);
      return { ok: false, motivo: "error" };
    }
    return { ok: true, sigue: true };
  }

  const { error } = await supabase
    .from("restaurant_followers")
    .update({ notify_stories: encender })
    .eq("profile_id", user.id)
    .eq("restaurant_id", restauranteId);

  if (error) {
    console.error("alerta", error.message);
    return { ok: false, motivo: "error" };
  }
  return { ok: true, sigue: true };
}

export async function alternarMeGusta(postId, meGusta) {
  const { supabase, user } = await conSesion();
  if (!user) return { ok: false, motivo: "sesion" };

  if (meGusta) {
    const { error } = await supabase
      .from("social_likes")
      .insert({ post_id: postId, profile_id: user.id });
    if (error && error.code !== "23505") {
      console.error("me gusta", error.message);
      return { ok: false, motivo: "error" };
    }
  } else {
    const { error } = await supabase
      .from("social_likes")
      .delete()
      .eq("post_id", postId)
      .eq("profile_id", user.id);
    if (error) {
      console.error("quitar me gusta", error.message);
      return { ok: false, motivo: "error" };
    }
  }

  return { ok: true };
}

export async function comentar(postId, texto) {
  const { supabase, user } = await conSesion();
  if (!user) return { ok: false, motivo: "sesion" };

  const cuerpo = String(texto ?? "").trim();
  if (!cuerpo) return { ok: false, motivo: "vacio" };
  if (cuerpo.length > MAX_TEXTO_COMENTARIO) {
    return { ok: false, motivo: "largo" };
  }

  const { data, error } = await supabase
    .from("social_comments")
    .insert({ post_id: postId, author_id: user.id, body: cuerpo })
    .select("id, body, created_at")
    .single();

  if (error) {
    console.error("comentar", error.message);
    return { ok: false, motivo: "error" };
  }

  // El nombre no viene del insert —`profiles` es privado y la fila devuelta no
  // lo trae—, así que se lee aparte del propio perfil, que sí se puede leer.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    ok: true,
    comentario: {
      id: data.id,
      body: data.body,
      created_at: data.created_at,
      author_id: user.id,
      author_name: perfil?.full_name?.trim() || "Comensal",
      puedo_borrar: true,
    },
  };
}

export async function borrarComentario(comentarioId) {
  const { supabase, user } = await conSesion();
  if (!user) return { ok: false, motivo: "sesion" };

  // Sin filtro por autor a propósito: la política deja borrar el propio
  // comentario *o* cualquiera que cuelgue de contenido propio, y el dueño de la
  // publicación tiene que poder quitar un insulto de debajo de su foto. Quién
  // puede lo decide la RLS, que es la que sabe las dos cosas.
  const { error } = await supabase.from("social_comments").delete().eq("id", comentarioId);

  if (error) {
    console.error("borrar comentario", error.message);
    return { ok: false, motivo: "error" };
  }
  return { ok: true };
}

// Los comentarios se piden cuando alguien abre el hilo y no al pintar la ficha:
// una ficha con diez publicaciones traería doscientos comentarios que casi
// nadie va a leer.
export async function comentariosDe(postId, antes = null) {
  const supabase = await supabaseSession();
  const { data, error } = await supabase.rpc("comentarios_publicacion", {
    pid: postId,
    limite: 20,
    antes,
  });

  if (error) {
    console.error("comentarios", error.message);
    return { ok: false, comentarios: [] };
  }
  // Llegan de la más nueva a la más vieja porque así se pagina; se leen al
  // revés, como una conversación.
  return { ok: true, comentarios: (data ?? []).slice().reverse() };
}

// Una historia vista. Se manda al abrirla en el visor y falla en silencio: el
// conteo de visualizaciones nunca vale interrumpir a quien está mirando.
export async function marcarVista(postId) {
  const { supabase, user } = await conSesion();
  if (!user) return { ok: false, motivo: "sesion" };

  const { error } = await supabase
    .from("social_story_views")
    .insert({ post_id: postId, profile_id: user.id });

  // 23505 es "ya la había visto", que es el caso normal a partir de la segunda
  // vez y no un fallo.
  if (error && error.code !== "23505") return { ok: false, motivo: "error" };
  return { ok: true };
}

// Más publicaciones de una ficha. El cursor es la fecha de la última que ya se
// pintó, no un número de página: publicar mientras alguien baja movería todas
// las páginas un lugar y repetiría una pieza.
export async function masPublicaciones(restauranteId, antes) {
  const supabase = await supabaseSession();
  const { data, error } = await supabase.rpc("publicaciones_restaurante", {
    rid: restauranteId,
    limite: POR_PAGINA,
    antes,
  });

  if (error) {
    console.error("mas publicaciones", error.message);
    return { ok: false, publicaciones: [] };
  }
  return { ok: true, publicaciones: data ?? [] };
}

// Marcar la bandeja como leída. Va con `revalidatePath` porque el punto del
// menú se pinta en el servidor.
export async function marcarAvisosLeidos() {
  const { supabase, user } = await conSesion();
  if (!user) return { ok: false, motivo: "sesion" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("marcar avisos", error.message);
    return { ok: false, motivo: "error" };
  }

  revalidatePath("/avisos");
  revalidatePath("/novedades");
  return { ok: true };
}
