// El alta guiada: qué le falta a una ficha para verse completa y qué conviene
// avisar antes de publicarla (#88). Es una función pura sobre lo que el editor
// ya carga —horarios, fotos, coordenadas, menús y platillos— más los pasos del
// embudo que guarda `alta_pasos`, así que no cuesta otra consulta y se prueba
// sin base.

// Los pasos del embudo, en el orden en que los da un dueño. La base tiene el
// mismo catálogo en el `check` de `alta_pasos.paso`.
export const PASOS_DEL_EMBUDO = ["alta_creada", "menu_creado", "qr_descargado", "ficha_publicada"];

export function pasoValido(paso) {
  return PASOS_DEL_EMBUDO.includes(paso);
}

// Un menú cuenta como carta si se ve y tiene algo que enseñar: platillos, o el
// archivo de la carta impresa. Uno visible y vacío es la ficha "a medias" que
// el panel ya advertía.
export function menuConContenido(menu, platillos = []) {
  if (!menu?.is_visible) return false;
  if (menu.kind === "archivo") return Boolean(menu.file_path);
  return platillos.some((p) => p.menu_id === menu.id);
}

/**
 * La lista "Para publicar tu ficha". Cada paso trae `clave`, `titulo`,
 * `listo` y `ayuda` (lo que hay que hacer si falta). `bloqueaPublicar` marca
 * los dos sin los que la ficha se ve rota: sin carta, el QR lleva a una página
 * vacía; sin dirección, no hay cómo llegar ni aparece en el mapa.
 */
export function pasosDeAlta({ restaurante, coords, horarios, fotos, menus, platillos, pasos }) {
  const hechos = new Set(pasos ?? []);
  const tieneCarta = (menus ?? []).some((m) => menuConContenido(m, platillos ?? []));

  return [
    {
      clave: "direccion",
      titulo: "Dirección con su punto en el mapa",
      listo: Boolean(restaurante?.street && coords?.lat != null && coords?.lng != null),
      ayuda: "Escribe la calle y marca el punto, para que te encuentren en el mapa.",
      bloqueaPublicar: true,
    },
    {
      clave: "horario",
      titulo: "Horario",
      listo: (horarios ?? []).length > 0,
      ayuda: "Di qué días abres y a qué hora: es lo primero que se pregunta.",
      bloqueaPublicar: false,
    },
    {
      clave: "foto",
      titulo: "Al menos una foto",
      listo: (fotos ?? []).some((f) => f.is_visible !== false),
      ayuda: "La fachada o tu platillo estrella. Una ficha sin foto se salta.",
      bloqueaPublicar: false,
    },
    {
      clave: "carta",
      titulo: "Tu carta, con platillos",
      listo: tieneCarta,
      ayuda: (menus ?? []).length
        ? "Tienes menús, pero ninguno visible con platillos o con su archivo."
        : "Tómale una foto a tu carta impresa y la convertimos en platillos.",
      bloqueaPublicar: true,
    },
    {
      clave: "qr",
      titulo: "Descargar tu QR",
      listo: hechos.has("qr_descargado"),
      ayuda: "Es lo que pegas en la mesa: lleva a tu ficha.",
      bloqueaPublicar: false,
    },
    {
      clave: "publicar",
      titulo: "Publicar la ficha",
      listo: restaurante?.status === "publicado",
      ayuda: "Mientras esté en borrador, solo tú la ves.",
      bloqueaPublicar: false,
    },
  ];
}

export function avanceDeAlta(lista) {
  const total = lista.length;
  const listos = lista.filter((p) => p.listo).length;
  return { listos, total, completa: listos === total };
}

// Lo que conviene avisar antes de publicar: no impide nada, pero el dueño
// tiene que decidir sabiendo que su ficha va a salir a medias.
export function faltanParaPublicar(lista) {
  return lista.filter((p) => p.bloqueaPublicar && !p.listo).map((p) => p.titulo);
}

/**
 * Anota que una ficha dio un paso del embudo, solo la primera vez (la llave
 * de `alta_pasos` es ficha y paso). Va con la sesión del dueño: la RLS deja
 * escribir solo en fichas propias. Nunca truena: medir no puede romper la
 * acción que se mide.
 */
export async function registrarPaso(supabase, restauranteId, paso) {
  if (!restauranteId || !pasoValido(paso)) return;
  try {
    const { error } = await supabase
      .from("alta_pasos")
      .upsert({ restaurant_id: restauranteId, paso }, { onConflict: "restaurant_id,paso", ignoreDuplicates: true });
    if (error) console.error("alta: no se pudo anotar el paso", paso, error.message);
  } catch (e) {
    console.error("alta: no se pudo anotar el paso", paso, e?.message);
  }
}
