"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../../lib/supabase";
import { menusIncluidos } from "../../../../lib/planes";
import { plantillaValida } from "../../../../lib/plantillas";
import { aCentavos } from "../../../../lib/precios";
import { MAX_ARCHIVO_BYTES } from "../../../../lib/subidas";

const BUCKET_MENUS = "menus";
const TIPOS_ARCHIVO = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const TIPOS_MENU = ["digital", "archivo"];

// Igual que en el resto del panel: la RLS ya impide tocar lo ajeno, pero
// comprobarlo aquí permite contestar "ese restaurante no es tuyo" en vez de
// devolver un update que no afectó a nadie.
async function sesionYRestaurante(id) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, plan, premium_until")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  return { supabase, restaurante };
}

async function menuDelDueno(supabase, restauranteId, menuId) {
  const { data } = await supabase
    .from("menus")
    .select("id, restaurant_id, name, kind, template, file_path, is_visible")
    .eq("id", menuId)
    .eq("restaurant_id", restauranteId)
    .maybeSingle();
  return data ?? null;
}

const NO_ES_TUYO = { status: "error", message: "Ese restaurante no es tuyo." };
const NO_ES_TU_MENU = { status: "error", message: "Ese menú no es tuyo." };

function limpio(formData, campo) {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor || null;
}

function esLimiteDeMenus(error) {
  return String(error?.message ?? "").includes("limite_de_menus");
}

function refrescar(id, menuId) {
  revalidatePath(`/panel/${id}`);
  revalidatePath(`/panel/${id}/menus`);
  if (menuId) revalidatePath(`/panel/${id}/menus/${menuId}`);
}

/* ---------- menús ---------- */

export async function crearMenu(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) {
    return { status: "error", message: "Ponle nombre al menú. Por ejemplo: Bebidas." };
  }
  if (nombre.length > 60) {
    return { status: "error", message: "Usa un nombre más corto." };
  }

  const tipo = String(formData.get("kind") ?? "digital");
  const kind = TIPOS_MENU.includes(tipo) ? tipo : "digital";
  const template = plantillaValida(String(formData.get("template") ?? ""));

  const { count } = await supabase
    .from("menus")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", id);

  const cupo = menusIncluidos(restaurante);
  // La base también lo impide; esto es para decirlo con palabras antes de que
  // el error suba desde Postgres.
  if ((count ?? 0) >= cupo) {
    return {
      status: "error",
      message: `Tu plan incluye ${cupo} menús y ya los tienes todos. Sube de plan o borra uno.`,
    };
  }

  const { data: creado, error } = await supabase
    .from("menus")
    .insert({
      restaurant_id: id,
      name: nombre,
      kind,
      template,
      position: count ?? 0,
    })
    .select("id")
    .single();

  if (error) {
    if (esLimiteDeMenus(error)) {
      return {
        status: "error",
        message: `Tu plan incluye ${cupo} menús y ya los tienes todos.`,
      };
    }
    console.error("crear menu", error.message);
    return { status: "error", message: "No pudimos crear el menú." };
  }

  refrescar(id, creado.id);
  return { status: "ok", message: `"${nombre}" creado.`, menuId: creado.id };
}

export async function guardarMenu(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu) return NO_ES_TU_MENU;

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) {
    return { status: "error", message: "Ponle nombre al menú." };
  }
  if (nombre.length > 60) {
    return { status: "error", message: "Usa un nombre más corto." };
  }

  const tipo = String(formData.get("kind") ?? menu.kind);
  const { error } = await supabase
    .from("menus")
    .update({
      name: nombre,
      kind: TIPOS_MENU.includes(tipo) ? tipo : menu.kind,
      template: plantillaValida(String(formData.get("template") ?? menu.template)),
      is_visible: formData.get("visible") === "on",
    })
    .eq("id", menuId)
    .eq("restaurant_id", id);

  if (error) {
    console.error("guardar menu", error.message);
    return { status: "error", message: "No pudimos guardar el menú." };
  }

  refrescar(id, menuId);
  return { status: "ok", message: "Menú guardado." };
}

export async function cambiarVisibilidadMenu(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu) return;

  await supabase
    .from("menus")
    .update({ is_visible: !menu.is_visible })
    .eq("id", menuId)
    .eq("restaurant_id", id);

  refrescar(id, menuId);
}

export async function borrarMenu(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu) return;

  // Primero la fila: si el borrado falla, el archivo sigue teniendo dueño. Al
  // revés quedaría un menú apuntando a un archivo que ya no está.
  const { error } = await supabase
    .from("menus")
    .delete()
    .eq("id", menuId)
    .eq("restaurant_id", id);

  if (error) {
    console.error("borrar menu", error.message);
    return;
  }

  if (menu.file_path) {
    await supabase.storage.from(BUCKET_MENUS).remove([menu.file_path]);
  }

  refrescar(id);
  redirect(`/panel/${id}/menus`);
}

// Subir y bajar mueve una posición: es lo que se entiende sin explicación y no
// necesita arrastrar nada, que en un teléfono es lo que más falla.
export async function moverMenu(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const direccion = String(formData.get("dir") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const { data: menus } = await supabase
    .from("menus")
    .select("id, position")
    .eq("restaurant_id", id)
    .order("position")
    .order("created_at");

  await intercambiar(supabase, "menus", menus ?? [], menuId, direccion);
  refrescar(id, menuId);
}

// Las posiciones nacieron de un contador y pueden venir repetidas o con
// huecos. En vez de confiar en ellas se reenumera la lista ya ordenada y se
// intercambian dos vecinos: así el resultado es el mismo aunque el estado
// previo sea irregular.
async function intercambiar(supabase, tabla, filas, filaId, direccion) {
  const indice = filas.findIndex((f) => f.id === filaId);
  if (indice < 0) return;

  const destino = direccion === "arriba" ? indice - 1 : indice + 1;
  if (destino < 0 || destino >= filas.length) return;

  const orden = filas.map((f) => f.id);
  orden[indice] = filas[destino].id;
  orden[destino] = filas[indice].id;

  for (let i = 0; i < orden.length; i += 1) {
    if (filas[i].id === orden[i] && filas[i].position === i) continue;
    await supabase.from(tabla).update({ position: i }).eq("id", orden[i]);
  }
}

/* ---------- el menú que sube el dueño ---------- */

export async function subirArchivoMenu(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu) return NO_ES_TU_MENU;

  const archivo = formData.get("archivo");
  if (!archivo || typeof archivo !== "object" || archivo.size === 0) {
    return { status: "error", message: "Elige el archivo de tu menú." };
  }
  const extension = TIPOS_ARCHIVO[archivo.type];
  if (!extension) {
    return { status: "error", message: "El menú va en PDF, JPG, PNG o WebP." };
  }
  if (archivo.size > MAX_ARCHIVO_BYTES) {
    return { status: "error", message: "El archivo debe pesar menos de 10 MB." };
  }

  // La primera carpeta es el id del restaurante: de ahí saca el permiso la
  // política de Storage.
  const ruta = `${id}/${crypto.randomUUID()}.${extension}`;
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_MENUS)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (errorSubida) {
    console.error("subir menu", errorSubida.message);
    return { status: "error", message: "No pudimos subir el archivo." };
  }

  const anterior = menu.file_path;
  const { error } = await supabase
    .from("menus")
    .update({ file_path: ruta, file_mime: archivo.type, kind: "archivo" })
    .eq("id", menuId)
    .eq("restaurant_id", id);

  if (error) {
    console.error("registrar menu subido", error.message);
    // Un archivo sin fila es basura invisible en el bucket.
    await supabase.storage.from(BUCKET_MENUS).remove([ruta]);
    return { status: "error", message: "No pudimos guardar el archivo." };
  }

  // El anterior se borra al final: si se borrara antes y el update fallara, el
  // menú se quedaría sin archivo ninguno.
  if (anterior && anterior !== ruta) {
    await supabase.storage.from(BUCKET_MENUS).remove([anterior]);
  }

  refrescar(id, menuId);
  return { status: "ok", message: "Menú subido." };
}

export async function quitarArchivoMenu(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu?.file_path) return;

  const { error } = await supabase
    .from("menus")
    .update({ file_path: null, file_mime: null })
    .eq("id", menuId)
    .eq("restaurant_id", id);

  if (error) {
    console.error("quitar menu subido", error.message);
    return;
  }

  await supabase.storage.from(BUCKET_MENUS).remove([menu.file_path]);
  refrescar(id, menuId);
}

/* ---------- secciones ---------- */

export async function crearSeccion(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;
  if (!(await menuDelDueno(supabase, id, menuId))) return NO_ES_TU_MENU;

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) {
    return { status: "error", message: "Escribe el nombre de la sección." };
  }
  if (nombre.length > 60) {
    return { status: "error", message: "Usa un nombre más corto." };
  }

  const { count } = await supabase
    .from("menu_sections")
    .select("id", { count: "exact", head: true })
    .eq("menu_id", menuId);

  const { error } = await supabase.from("menu_sections").insert({
    restaurant_id: id,
    menu_id: menuId,
    name: nombre,
    position: count ?? 0,
  });

  if (error) {
    console.error("crear seccion", error.message);
    return { status: "error", message: "No pudimos crear la sección." };
  }

  refrescar(id, menuId);
  return { status: "ok", message: `"${nombre}" agregada.` };
}

export async function renombrarSeccion(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const seccionId = String(formData.get("seccion") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2 || nombre.length > 60) {
    return { status: "error", message: "El nombre de la sección no sirve." };
  }

  const { error } = await supabase
    .from("menu_sections")
    .update({ name: nombre })
    .eq("id", seccionId)
    .eq("menu_id", menuId)
    .eq("restaurant_id", id);

  if (error) {
    console.error("renombrar seccion", error.message);
    return { status: "error", message: "No pudimos renombrar la sección." };
  }

  refrescar(id, menuId);
  return { status: "ok", message: "Sección renombrada." };
}

export async function borrarSeccion(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const seccionId = String(formData.get("seccion") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  // Los platillos no se van con la sección: la base les pone section_id en
  // nulo y quedan al final del menú, sin agrupar. Borrar "Entradas" por
  // equivocación no debe costar quince platillos.
  await supabase
    .from("menu_sections")
    .delete()
    .eq("id", seccionId)
    .eq("menu_id", menuId)
    .eq("restaurant_id", id);

  refrescar(id, menuId);
}

export async function moverSeccion(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const seccionId = String(formData.get("seccion") ?? "");
  const direccion = String(formData.get("dir") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const { data: secciones } = await supabase
    .from("menu_sections")
    .select("id, position")
    .eq("menu_id", menuId)
    .eq("restaurant_id", id)
    .order("position")
    .order("created_at");

  await intercambiar(supabase, "menu_sections", secciones ?? [], seccionId, direccion);
  refrescar(id, menuId);
}

/* ---------- platillos ---------- */

export async function guardarPlatillo(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const platilloId = limpio(formData, "platillo");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;
  if (!(await menuDelDueno(supabase, id, menuId))) return NO_ES_TU_MENU;

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) {
    return { status: "error", message: "Escribe el nombre del platillo." };
  }
  if (nombre.length > 120) {
    return { status: "error", message: "Usa un nombre más corto." };
  }

  const centavos = aCentavos(formData.get("precio"));
  if (centavos === undefined) {
    return {
      status: "error",
      message: "El precio tiene que ser un número. Ejemplo: 89 o 89.50.",
    };
  }

  // Una sección vacía en el formulario es "sin sección", que es un platillo
  // suelto y no un error.
  const seccionId = limpio(formData, "seccion");
  if (seccionId) {
    const { data: seccion } = await supabase
      .from("menu_sections")
      .select("id")
      .eq("id", seccionId)
      .eq("menu_id", menuId)
      .maybeSingle();
    if (!seccion) {
      return { status: "error", message: "Esa sección no es de este menú." };
    }
  }

  const campos = {
    name: nombre,
    description: limpio(formData, "descripcion"),
    price_cents: centavos,
    section_id: seccionId,
    is_available: formData.get("agotado") !== "on",
  };

  if (platilloId) {
    const { error } = await supabase
      .from("menu_items")
      .update(campos)
      .eq("id", platilloId)
      .eq("menu_id", menuId)
      .eq("restaurant_id", id);

    if (error) {
      console.error("guardar platillo", error.message);
      return { status: "error", message: "No pudimos guardar el platillo." };
    }

    refrescar(id, menuId);
    return { status: "ok", message: "Platillo guardado." };
  }

  // La posición se cuenta dentro de la sección: cada una lleva su propio
  // orden y así mover un platillo no reordena el menú entero.
  const conteo = supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("menu_id", menuId);
  const { count } = await (seccionId
    ? conteo.eq("section_id", seccionId)
    : conteo.is("section_id", null));

  const { error } = await supabase.from("menu_items").insert({
    restaurant_id: id,
    menu_id: menuId,
    ...campos,
    position: count ?? 0,
  });

  if (error) {
    console.error("crear platillo", error.message);
    return { status: "error", message: "No pudimos agregar el platillo." };
  }

  refrescar(id, menuId);
  return { status: "ok", message: `"${nombre}" agregado.` };
}

export async function borrarPlatillo(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const platilloId = String(formData.get("platillo") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  await supabase
    .from("menu_items")
    .delete()
    .eq("id", platilloId)
    .eq("menu_id", menuId)
    .eq("restaurant_id", id);

  refrescar(id, menuId);
}

export async function moverPlatillo(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const platilloId = String(formData.get("platillo") ?? "");
  const seccionId = limpio(formData, "seccion");
  const direccion = String(formData.get("dir") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const consulta = supabase
    .from("menu_items")
    .select("id, position")
    .eq("menu_id", menuId)
    .eq("restaurant_id", id)
    .order("position")
    .order("created_at");

  const { data: platillos } = await (seccionId
    ? consulta.eq("section_id", seccionId)
    : consulta.is("section_id", null));

  await intercambiar(supabase, "menu_items", platillos ?? [], platilloId, direccion);
  refrescar(id, menuId);
}

export async function cambiarDisponibilidad(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const platilloId = String(formData.get("platillo") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const { data: platillo } = await supabase
    .from("menu_items")
    .select("is_available")
    .eq("id", platilloId)
    .eq("menu_id", menuId)
    .eq("restaurant_id", id)
    .maybeSingle();

  if (!platillo) return;

  await supabase
    .from("menu_items")
    .update({ is_available: !platillo.is_available })
    .eq("id", platilloId)
    .eq("menu_id", menuId)
    .eq("restaurant_id", id);

  refrescar(id, menuId);
}
