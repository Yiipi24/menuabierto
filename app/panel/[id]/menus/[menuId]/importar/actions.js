"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseSession } from "../../../../../../lib/supabase";
import { invalidarFicha } from "../../../../../../lib/cache";
import { leerRevision, tipoDeEntrada } from "../../../../../../lib/extraccion";
import { leerCarta, visionConfigurada } from "../../../../../../lib/vision";
import { MAX_ARCHIVO_BYTES } from "../../../../../../lib/subidas";
import { uuidValido } from "../../../../../../lib/slug";
import { cupoDeLecturas } from "./cupo";

const BUCKET_MENUS = "menus";

const NO_ES_TUYO = { status: "error", message: "Ese restaurante no es tuyo." };

async function sesionMenuYRestaurante(id, menuId) {
  if (!uuidValido(id) || !uuidValido(menuId)) return { supabase: null, auth: null, restaurante: null, menu: null };
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, slug, plan, premium_until")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!restaurante) return { supabase, auth, restaurante: null, menu: null };

  const { data: menu } = await supabase
    .from("menus")
    .select("id, name, kind, file_path, file_mime")
    .eq("id", menuId)
    .eq("restaurant_id", id)
    .maybeSingle();
  return { supabase, auth, restaurante, menu: menu ?? null };
}

/**
 * Leer la carta. Sube nada a Storage: la foto viaja a la API y se descarta.
 * Lo que se guarda es el resultado, en `menu_extractions`, y ahí se queda
 * hasta que el dueño lo revise. Nada entra al menú desde aquí.
 */
export async function extraerMenu(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, auth, restaurante, menu } = await sesionMenuYRestaurante(id, menuId);
  if (!restaurante) return NO_ES_TUYO;
  if (!menu) return { status: "error", message: "Ese menú no es tuyo." };

  if (!visionConfigurada()) {
    return { status: "error", message: "La lectura de cartas todavía no está habilitada en este sitio." };
  }

  const cupo = await cupoDeLecturas(supabase, restaurante);
  if (cupo.quedan <= 0) {
    return {
      status: "error",
      message: `Tu plan incluye ${cupo.incluidas} lecturas al mes y ya las usaste. Captura a mano, espera al mes que entra o sube de plan.`,
    };
  }

  // La foto que acaban de elegir, o el archivo que el menú ya tiene subido.
  let bytes;
  let mime;
  let rutaArchivo = null;
  const archivo = formData.get("archivo");
  if (archivo && typeof archivo === "object" && archivo.size > 0) {
    if (archivo.size > MAX_ARCHIVO_BYTES) {
      return { status: "error", message: "El archivo debe pesar menos de 10 MB." };
    }
    mime = archivo.type;
    bytes = new Uint8Array(await archivo.arrayBuffer());
  } else if (formData.get("usar_archivo") === "on" && menu.file_path) {
    const { data, error } = await supabase.storage.from(BUCKET_MENUS).download(menu.file_path);
    if (error || !data) {
      return { status: "error", message: "No pudimos leer el archivo del menú. Sube la foto otra vez." };
    }
    mime = menu.file_mime ?? data.type;
    bytes = new Uint8Array(await data.arrayBuffer());
    rutaArchivo = menu.file_path;
  } else {
    return { status: "error", message: "Elige la foto o el PDF de tu carta." };
  }

  if (!tipoDeEntrada(mime)) {
    return { status: "error", message: "La carta va en JPG, PNG, WebP o PDF." };
  }

  let resultado;
  try {
    resultado = await leerCarta({ bytes, mime });
  } catch (error) {
    console.error("leer carta", error?.message);
    // Un fallo nuestro o de la API se registra pero no cuenta contra el cupo.
    await supabase.from("menu_extractions").insert({
      restaurant_id: id,
      menu_id: menuId,
      created_by: auth.user.id,
      status: "error",
      file_path: rutaArchivo,
      file_mime: mime,
      result: { error: String(error?.message ?? error).slice(0, 300) },
    });
    return {
      status: "error",
      message: "No pudimos leer la carta ahora. Inténtalo en un momento; este intento no cuenta.",
    };
  }

  const { extraccion, uso } = resultado;
  const { data: fila, error } = await supabase
    .from("menu_extractions")
    .insert({
      restaurant_id: id,
      menu_id: menuId,
      created_by: auth.user.id,
      status: extraccion.legible ? "ok" : "ilegible",
      file_path: rutaArchivo,
      file_mime: mime,
      model: uso.modelo,
      input_tokens: uso.entrada,
      output_tokens: uso.salida,
      result: extraccion,
    })
    .select("id")
    .single();

  if (error) {
    console.error("registrar extraccion", error.message);
    return { status: "error", message: "Leímos la carta pero no pudimos guardar el resultado. Inténtalo otra vez." };
  }

  if (!extraccion.legible) {
    return {
      status: "ilegible",
      message: `No se pudo leer: ${extraccion.motivo} Prueba con una foto más cercana, con buena luz y sin reflejos.`,
      quedan: cupo.quedan - 1,
    };
  }

  redirect(`/panel/${id}/menus/${menuId}/importar?revisar=${fila.id}`);
}

/**
 * Pasar al menú lo que el dueño revisó. Es el único camino por el que una
 * lectura llega a `menu_sections` y `menu_items`, y llega ya corregida: lo que
 * se inserta es el JSON de la pantalla de revisión, no el del modelo.
 */
export async function aplicarExtraccion(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const extraccionId = String(formData.get("extraccion") ?? "");
  const { supabase, restaurante, menu } = await sesionMenuYRestaurante(id, menuId);
  if (!restaurante) return NO_ES_TUYO;
  if (!menu) return { status: "error", message: "Ese menú no es tuyo." };
  if (!uuidValido(extraccionId)) return { status: "error", message: "Esa lectura no existe." };

  const { data: extraccion } = await supabase
    .from("menu_extractions")
    .select("id, status")
    .eq("id", extraccionId)
    .eq("restaurant_id", id)
    .maybeSingle();
  if (!extraccion) return { status: "error", message: "Esa lectura no existe." };
  if (extraccion.status === "aplicada") {
    return { status: "error", message: "Esa lectura ya se pasó al menú. Vuelve al editor para ajustarla." };
  }

  const revision = leerRevision(String(formData.get("revision") ?? ""));
  if (revision.error) return { status: "error", message: revision.error };

  // Las secciones nuevas van después de las que ya haya: importar sobre una
  // carta a medias no debe reordenarla.
  const { count: seccionesPrevias } = await supabase
    .from("menu_sections")
    .select("id", { count: "exact", head: true })
    .eq("menu_id", menuId);

  let posicion = seccionesPrevias ?? 0;
  for (const s of revision.secciones) {
    const { data: seccion, error: errorSeccion } = await supabase
      .from("menu_sections")
      .insert({ restaurant_id: id, menu_id: menuId, name: s.nombre, position: posicion })
      .select("id")
      .single();
    if (errorSeccion) {
      console.error("aplicar extraccion: seccion", errorSeccion.message);
      return { status: "error", message: `No pudimos crear la sección "${s.nombre}". Lo que ya entró está en el editor.` };
    }
    posicion += 1;

    const filas = s.platillos.map((p, i) => ({
      restaurant_id: id,
      menu_id: menuId,
      section_id: seccion.id,
      name: p.nombre,
      description: p.descripcion,
      price_cents: p.precio,
      // Nulo es "auto": la carta lo deduce del nombre, igual que al capturar a
      // mano. Se guarda nulo y no el sugerido para que un cambio de nombre lo
      // corrija solo.
      icon: null,
      labels: [],
      is_available: true,
      position: i,
    }));
    const { error: errorPlatillos } = await supabase.from("menu_items").insert(filas);
    if (errorPlatillos) {
      console.error("aplicar extraccion: platillos", errorPlatillos.message);
      return { status: "error", message: `No pudimos guardar los platillos de "${s.nombre}". Lo que ya entró está en el editor.` };
    }
  }

  // Un menú que era "archivo" pasa a ser digital: ahora tiene platillos. El
  // archivo se queda guardado por si quieren volver a él.
  const cambios = menu.kind === "archivo" ? { kind: "digital" } : {};
  if (Object.keys(cambios).length) {
    await supabase.from("menus").update(cambios).eq("id", menuId).eq("restaurant_id", id);
  }

  await supabase
    .from("menu_extractions")
    .update({ status: "aplicada", applied_at: new Date().toISOString() })
    .eq("id", extraccionId)
    .eq("restaurant_id", id);

  revalidatePath(`/panel/${id}`);
  revalidatePath(`/panel/${id}/menus`);
  revalidatePath(`/panel/${id}/menus/${menuId}`);
  invalidarFicha(restaurante.slug);

  redirect(`/panel/${id}/menus/${menuId}?importados=${revision.total}`);
}
