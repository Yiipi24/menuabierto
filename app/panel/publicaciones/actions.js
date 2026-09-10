"use server";

import { revalidatePath } from "next/cache";
import { repartirPushDeAventon } from "../../../lib/push";
import { invalidarFicha } from "../../../lib/cache";
import { supabaseSession } from "../../../lib/supabase";
import { repartirProgramadas } from "../../_social/datos";
import {
  BUCKET_SOCIAL,
  MAX_TEXTO_POST,
  extensionDeMime,
  mediaDeMime,
  revisarMedia,
  revisarProgramacion,
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

  // Antes de leer, repartir lo que ya salió: el dueño que abre su panel es
  // quien más probablemente tenga algo programado esperando la hora, y así el
  // aviso a sus seguidores no depende de que otra persona pase por el feed.
  await repartirProgramadas(supabase);

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

// La hora de salida que pide el formulario, ya validada. Devuelve `{ error }`
// con el aviso, o `{ publishAt }` con la fecha ISO —o null si sale ahora.
function leerProgramacion(formData) {
  const cuando = String(formData.get("cuando") ?? "ahora");
  if (cuando !== "programar") return { publishAt: null };

  const valor = String(formData.get("publish_at") ?? "");
  const aviso = revisarProgramacion(valor);
  if (aviso) return { error: aviso };

  return { publishAt: new Date(valor).toISOString() };
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

  // La hora se valida antes de subir diez megas: rechazar la fecha después de
  // la subida es hacer esperar para nada.
  const { publishAt, error: errorFecha } = leerProgramacion(formData);
  if (errorFecha) return fallo(errorFecha);

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
      // Nulo no llega nunca a la columna: el trigger pone `now()`. Se manda
      // así para que "publicar ahora" y "programar" sean el mismo camino.
      ...(publishAt ? { publish_at: publishAt } : {}),
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
  // Los avisos de la historia los crea el trigger; el push sale de aventón.
  repartirPushDeAventon();
  await revalidarFichas(supabase, validos);

  const cuantos = validos.length;
  const donde = cuantos === 1 ? "tu restaurante" : `tus ${cuantos} restaurantes`;

  // El aviso de las fichas en borrador se dice igual programando: enterarse el
  // martes de que la promoción del martes no se vio es tarde.
  const enBorrador = borradores.length
    ? ` Ojo: ${
        borradores.length === 1 ? "uno está" : `${borradores.length} están`
      } en borrador, así que ahí no se ve hasta que publiques la ficha.`
    : "";

  if (publishAt) {
    const cuando = new Date(publishAt).toLocaleString("es-MX", {
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: zonaDelFormulario(formData),
    });

    return {
      status: "ok",
      message: `Programado para el ${cuando} en ${donde}.${
        tipo === "historia" ? " Sus 24 horas empiezan a contar ahí." : ""
      }${enBorrador}`,
    };
  }

  if (enBorrador) {
    return { status: "ok", message: `Listo, se publicó en ${donde}.${enBorrador}` };
  }

  return {
    status: "ok",
    message:
      tipo === "historia"
        ? `Tu historia ya está en ${donde}. Se ve durante 24 horas.`
        : `Tu publicación ya está en ${donde}.`,
  };
}

// La zona horaria de quien llenó el formulario, que el navegador manda en un
// campo oculto. El servidor corre en UTC: sin esto, "programado para las 8:00"
// se le confirmaría al dueño como las 2:00 de la madrugada.
function zonaDelFormulario(formData) {
  const zona = String(formData.get("zona") ?? "").trim();
  try {
    // Una zona inventada revienta el formateo, y quedarse sin mensaje de éxito
    // por eso sería perder la publicación de vista.
    new Intl.DateTimeFormat("es-MX", { timeZone: zona });
    return zona;
  } catch {
    return "America/Mexico_City";
  }
}

/**
 * Copiar una historia o una publicación a otras sucursales.
 *
 * No hace una copia: agrega la misma pieza a más fichas. Duplicar el archivo y
 * la fila daría dos publicaciones con likes y comentarios repartidos entre las
 * dos, y para el dueño sería la misma foto contada dos veces. Una sola pieza en
 * varias fichas es lo que ya hace el formulario de alta cuando se marcan tres
 * restaurantes; esto es poder hacerlo después, cuando la promoción funcionó en
 * un local y se quiere en los otros.
 *
 * Solo suma. Quitarla de una ficha donde ya lleva días —con sus vistas y sus
 * comentarios— es otra cosa y se hace borrando la pieza entera.
 *
 * Para una historia el reloj no se reinicia: se ve en las nuevas fichas lo que
 * le quede de sus 24 horas. Reiniciarlo sería tener la misma historia viva en
 * un local y muerta en el de al lado.
 */
export async function copiarASucursales(_prevState, formData) {
  const { supabase, user } = await sesion();
  if (!user) return fallo("Tu sesión expiró. Entra otra vez.");

  const postId = String(formData.get("post") ?? "");
  const elegidos = formData.getAll("restaurantes").map(String).filter(Boolean);
  if (!elegidos.length) return fallo("Elige al menos una sucursal.");

  // Que la pieza sea suya. La política de `social_post_restaurants` lo exige
  // igual; aquí se comprueba antes para contestar con palabras.
  const { data: post } = await supabase
    .from("social_posts")
    .select("id, kind, expires_at")
    .eq("id", postId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (!post) return fallo("Esa publicación ya no es tuya. Recarga la página.");

  const { data: propios } = await supabase
    .from("restaurants")
    .select("id, status")
    .eq("owner_id", user.id)
    .in("id", elegidos);

  const validos = (propios ?? []).map((r) => r.id);
  if (validos.length !== elegidos.length) {
    return fallo("Una de las sucursales que elegiste ya no es tuya. Recarga la página.");
  }

  // Una historia caducada no se copia a ningún lado: nacería muerta en la
  // ficha nueva y el dueño creería que la repartió.
  if (post.expires_at && new Date(post.expires_at).getTime() <= Date.now()) {
    return fallo("Esa historia ya venció. Sube una nueva para las otras sucursales.");
  }

  // Las que ya la tienen se quedan fuera del insert: el índice las rechazaría
  // y se llevaría por delante a las que sí faltan.
  const { data: yaEstan } = await supabase
    .from("social_post_restaurants")
    .select("restaurant_id")
    .eq("post_id", postId);

  const puestos = new Set((yaEstan ?? []).map((f) => f.restaurant_id));
  const faltan = validos.filter((id) => !puestos.has(id));

  if (!faltan.length) {
    return fallo("Ya está publicada en todas las sucursales que elegiste.");
  }

  const { error } = await supabase
    .from("social_post_restaurants")
    .insert(faltan.map((id) => ({ post_id: postId, restaurant_id: id })));

  if (error) {
    console.error("copiar a sucursales", error.message);
    return fallo("No pudimos copiarla. Inténtalo otra vez.");
  }

  revalidatePath("/panel/publicaciones");
  await revalidarFichas(supabase, faltan);

  const borradores = (propios ?? []).filter(
    (r) => faltan.includes(r.id) && r.status !== "publicado",
  );
  const enBorrador = borradores.length
    ? ` Ojo: ${
        borradores.length === 1 ? "una está" : `${borradores.length} están`
      } en borrador, así que ahí no se ve hasta que publiques la ficha.`
    : "";

  const cuantas = faltan.length;
  return {
    status: "ok",
    message: `Listo, también sale en ${cuantas === 1 ? "una sucursal más" : `${cuantas} sucursales más`}.${enBorrador}`,
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

// Cambiar la hora de una pieza que todavía no sale, o adelantarla del todo.
//
// Las dos cosas son el mismo UPDATE porque son la misma decisión —cuándo
// sale—, y el trigger de la base es el que impide lo que no se puede: mover la
// fecha de algo ya publicado. Una historia reprogramada se lleva sus 24 horas
// con ella, así que la que sale el viernes se ve el viernes entero.
export async function reprogramar(_prevState, formData) {
  const { supabase, user } = await sesion();
  if (!user) return fallo("Tu sesión expiró. Entra otra vez.");

  const id = String(formData.get("id") ?? "");
  if (!id) return fallo("Recarga la página e inténtalo otra vez.");

  const ahora = String(formData.get("ahora") ?? "") === "1";

  let publishAt;
  if (ahora) {
    publishAt = new Date().toISOString();
  } else {
    const valor = String(formData.get("publish_at") ?? "");
    const aviso = revisarProgramacion(valor);
    if (aviso) return fallo(aviso);
    publishAt = new Date(valor).toISOString();
  }

  // Solo lo que todavía no salió. La comprobación se repite en el trigger, que
  // es el que manda; aquí sirve para poder decir por qué en vez de guardar en
  // silencio algo que la base va a ignorar.
  const { data: pieza } = await supabase
    .from("social_posts")
    .select("publish_at")
    .eq("id", id)
    .eq("author_id", user.id)
    .maybeSingle();

  if (!pieza) return fallo("No encontramos esa publicación. Recarga la página.");
  if (new Date(pieza.publish_at) <= new Date()) {
    return fallo("Esto ya se publicó, así que su fecha ya no se puede mover.");
  }

  const { error } = await supabase
    .from("social_posts")
    .update({ publish_at: publishAt })
    .eq("id", id)
    .eq("author_id", user.id);

  if (error) {
    console.error("reprogramar post", error.message);
    return fallo("No pudimos cambiar la fecha. Inténtalo otra vez.");
  }

  const { data: fichas } = await supabase
    .from("social_post_restaurants")
    .select("restaurant_id")
    .eq("post_id", id);

  const donde = (fichas ?? []).map((f) => f.restaurant_id);

  // Si acaba de salir, sus seguidores se enteran ahora y no cuando alguien
  // pase por el feed.
  if (ahora) await repartirProgramadas(supabase);

  revalidatePath("/panel/publicaciones");
  await revalidarFichas(supabase, donde);

  return {
    status: "ok",
    message: ahora ? "Listo, ya está publicado." : "Cambiamos la fecha.",
  };
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
