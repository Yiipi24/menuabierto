"use server";

import { revalidatePath } from "next/cache";
import { invalidarFicha } from "../../../../lib/cache";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../../lib/supabase";
import { menusIncluidos } from "../../../../lib/planes";
import { estiloDeMenu, nombreDePlantilla, plantillaValida } from "../../../../lib/plantillas";
import { franjaDe, franjaValida, horaValida } from "../../../../lib/horarios-menu";
import { iconoPlatilloValido } from "../../../../lib/iconos-platillo";
import { catalogoDeEtiquetas, etiquetasValidas } from "../../../../lib/etiquetas-platillo";
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
    .select("id, slug, plan, premium_until")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  return { supabase, restaurante };
}

async function menuDelDueno(supabase, restauranteId, menuId) {
  const { data } = await supabase
    .from("menus")
    .select("id, restaurant_id, name, description, kind, template, style, file_path, is_visible")
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

// Los ajustes de la plantilla viajan en un solo campo con JSON y no en siete
// casillas sueltas: una casilla sin palomita no llega en el formulario, así que
// "quitar los iconos" y "no mandó nada" se verían igual. `estiloDeMenu` sanea
// lo que salga de aquí, así que basura en ese campo no pasa de aquí.
function estiloDelFormulario(formData, template) {
  let crudo = null;
  try {
    crudo = JSON.parse(String(formData.get("estilo") ?? "null"));
  } catch {
    crudo = null;
  }
  return estiloDeMenu(template, crudo);
}

function esLimiteDeMenus(error) {
  return String(error?.message ?? "").includes("limite_de_menus");
}

// Toda escritura de una carta pasa por aquí, y por eso aquí es donde se tira
// la ficha pública: cambiar un precio en el panel y que la carta del QR siga
// enseñando el viejo sería peor que no tener caché. Recibe el restaurante
// entero y no su id porque hace falta el slug, que es como se guarda.
function refrescar(restaurante, menuId) {
  const id = restaurante.id;
  revalidatePath(`/panel/${id}`);
  revalidatePath(`/panel/${id}/menus`);
  if (menuId) revalidatePath(`/panel/${id}/menus/${menuId}`);
  invalidarFicha(restaurante.slug);
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
  const franja = franjaValida(String(formData.get("franja") ?? ""));

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
      service_time: franja,
      // Vacío a propósito: así el menú recién creado se ve como la plantilla
      // diga hoy, incluso si mañana le cambiamos los valores de fábrica.
      style: {},
      // El primero es la carta principal sin que nadie lo decida: un
      // restaurante con una sola carta tiene, por definición, esa.
      is_primary: (count ?? 0) === 0,
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

  refrescar(restaurante, creado.id);
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

  // Vacía se guarda como nula, no como cadena vacía: nulo es lo que la ficha
  // lee como "ármala tú con las secciones".
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (descripcion.length > 140) {
    return { status: "error", message: "La descripción es muy larga. Deja una línea." };
  }

  const tipo = String(formData.get("kind") ?? menu.kind);
  const template = plantillaValida(String(formData.get("template") ?? menu.template));
  const { error } = await supabase
    .from("menus")
    .update({
      name: nombre,
      description: descripcion || null,
      kind: TIPOS_MENU.includes(tipo) ? tipo : menu.kind,
      template,
      style: estiloDelFormulario(formData, template),
      is_visible: formData.get("visible") === "on",
    })
    .eq("id", menuId)
    .eq("restaurant_id", id);

  if (error) {
    console.error("guardar menu", error.message);
    return { status: "error", message: "No pudimos guardar el menú." };
  }

  refrescar(restaurante, menuId);
  // El mensaje nombra la plantilla que quedó guardada. Antes decía "Menú
  // guardado" a secas y, como el formulario se repinta, no había manera de
  // saber si el cambio de plantilla se había ido o no.
  return {
    status: "ok",
    message: `Guardado. Tu carta se ve con la plantilla ${nombreDePlantilla(template)}.`,
    template,
  };
}

export async function renombrarMenu(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu) return NO_ES_TU_MENU;

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 2) {
    return { status: "error", message: "Ponle nombre al menú. Por ejemplo: Bebidas." };
  }
  if (nombre.length > 60) {
    return { status: "error", message: "Usa un nombre más corto." };
  }
  if (nombre === menu.name) return { status: "ok", message: "" };

  const { error } = await supabase
    .from("menus")
    .update({ name: nombre })
    .eq("id", menuId)
    .eq("restaurant_id", id);

  if (error) {
    console.error("renombrar menu", error.message);
    return { status: "error", message: "No pudimos cambiar el nombre." };
  }

  refrescar(restaurante, menuId);
  return { status: "ok", message: `Ahora se llama "${nombre}".` };
}

// El horario de una carta son dos datos que se contestan juntos: la franja
// —desayuno, cena— y, si el dueño quiere, sus horas exactas. Dejar el rango
// vacío no es un error: significa "usa el de la franja", que es lo que ya
// hacía antes de esta pantalla.
export async function cambiarHorarioMenu(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu) return NO_ES_TU_MENU;

  const franja = franjaValida(String(formData.get("franja") ?? ""));
  const desdeBruto = limpio(formData, "desde");
  const hastaBruto = limpio(formData, "hasta");
  const desde = desdeBruto ? horaValida(desdeBruto) : null;
  const hasta = hastaBruto ? horaValida(hastaBruto) : null;

  if ((desdeBruto && !desde) || (hastaBruto && !hasta)) {
    return { status: "error", message: "Esa hora no se entiende. Usa el reloj del campo." };
  }
  // Media hora escrita no es un horario: sin la otra punta la ficha no puede
  // decir si la carta se está sirviendo, y se quedaría con la de la franja
  // sin avisar de que lo capturado se ignoró.
  if (Boolean(desde) !== Boolean(hasta)) {
    return { status: "error", message: "Pon las dos horas: desde cuándo y hasta cuándo." };
  }
  if (desde && desde === hasta) {
    return { status: "error", message: "La hora de inicio y la de fin no pueden ser la misma." };
  }

  const { error } = await supabase
    .from("menus")
    .update({ service_time: franja, serves_from: desde, serves_to: hasta })
    .eq("id", menuId)
    .eq("restaurant_id", id);

  if (error) {
    console.error("horario menu", error.message);
    return { status: "error", message: "No pudimos guardar el horario." };
  }

  refrescar(restaurante, menuId);
  return { status: "ok", message: `Se sirve en ${franjaDe(franja).nombre.toLowerCase()}.` };
}

// La carta principal es la que la ficha pone primero y la que abre el QR
// cuando hay varias. Que sea una sola lo garantiza la base: el trigger
// desmarca la anterior en la misma transacción, así que aquí no hay que
// apagarla antes ni cuidar el orden.
export async function establecerPrincipalMenu(formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu) return;

  const { error } = await supabase
    .from("menus")
    // Una carta oculta de principal dejaría la ficha señalando algo que nadie
    // puede abrir, así que marcarla como principal la publica.
    .update({ is_primary: true, is_visible: true })
    .eq("id", menuId)
    .eq("restaurant_id", id);

  if (error) console.error("menu principal", error.message);
  refrescar(restaurante, menuId);
}

/**
 * Duplicar una carta, aquí o en otra sucursal.
 *
 * Todo el trabajo lo hace `duplicar_menu` en la base: copiar tres tablas con
 * los ids remapeados tiene que ser una sola transacción, y una carta a medio
 * copiar es peor que ninguna. La función comprueba que las dos puntas sean del
 * mismo dueño, así que un id de destino ajeno no pasa de ahí.
 */
export async function duplicarMenu(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const menuId = String(formData.get("menu") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const menu = await menuDelDueno(supabase, id, menuId);
  if (!menu) return NO_ES_TU_MENU;

  const destino = String(formData.get("destino") ?? "") || id;
  const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 60);

  const { data: nuevo, error } = await supabase.rpc("duplicar_menu", {
    p_menu: menuId,
    p_destino: destino,
    p_nombre: nombre || null,
  });

  if (error) {
    if (esLimiteDeMenus(error)) {
      return {
        status: "error",
        message:
          destino === id
            ? "Ya tienes todos los menús que incluye tu plan. Sube de plan o borra uno."
            : "Esa sucursal ya tiene todos los menús que incluye su plan.",
      };
    }
    console.error("duplicar menu", error.message);
    return { status: "error", message: "No pudimos duplicar el menú." };
  }

  // La copia nace oculta —el dueño la revisa antes de que la vea nadie— así
  // que hay dos fichas que refrescar cuando el destino es otra sucursal.
  refrescar(restaurante, nuevo);
  if (destino !== id) {
    const { data: otra } = await supabase
      .from("restaurants")
      .select("id, slug")
      .eq("id", destino)
      .maybeSingle();
    if (otra) refrescar(otra, nuevo);
  }

  return {
    status: "ok",
    message:
      destino === id
        ? "Listo, tienes la copia. Nace oculta: revísala y publícala."
        : "Copiada a la otra sucursal. Nace oculta: revísala allá y publícala.",
    menuId: nuevo,
    destino,
  };
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

  refrescar(restaurante, menuId);
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

  refrescar(restaurante);
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
  refrescar(restaurante, menuId);
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

  refrescar(restaurante, menuId);
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
  refrescar(restaurante, menuId);
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

  refrescar(restaurante, menuId);
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

  refrescar(restaurante, menuId);
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

  refrescar(restaurante, menuId);
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
  refrescar(restaurante, menuId);
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

  // "auto" es el valor de fábrica: se guarda nulo y la carta lo deduce del
  // nombre. Así, si el dueño le cambia el nombre al platillo, el dibujo se
  // corrige solo en vez de quedarse con el del nombre viejo.
  const icono = String(formData.get("icono") ?? "auto");

  // Las etiquetas se filtran contra el catálogo antes de guardar. La base
  // también las valida con un trigger, pero ahí una clave inventada es una
  // excepción que el dueño vería como "no pudimos guardar el platillo"; aquí,
  // simplemente no se guarda. Y llegan siempre, aunque vengan vacías: quitarle
  // la última etiqueta a un platillo tiene que poder guardarse.
  const { data: filasEtiquetas } = await supabase
    .from("dish_labels")
    .select("slug, name, hint, icon, kind")
    .order("position");

  const etiquetas = etiquetasValidas(
    catalogoDeEtiquetas(filasEtiquetas ?? []),
    formData.getAll("etiquetas").map((v) => String(v)),
  );

  const campos = {
    name: nombre,
    description: limpio(formData, "descripcion"),
    price_cents: centavos,
    section_id: seccionId,
    icon: iconoPlatilloValido(icono) ? icono : null,
    labels: etiquetas,
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

    refrescar(restaurante, menuId);
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

  refrescar(restaurante, menuId);
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

  refrescar(restaurante, menuId);
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
  refrescar(restaurante, menuId);
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

  refrescar(restaurante, menuId);
}
