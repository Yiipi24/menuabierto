"use server";

import { revalidatePath } from "next/cache";
import { supabaseSession } from "../../lib/supabase";

export async function buscarFichas(_prevState, formData) {
  const texto = String(formData.get("q") ?? "").trim();
  if (texto.length < 3) {
    return {
      status: "error",
      message: "Escribe al menos tres letras del nombre.",
      resultados: [],
    };
  }

  const supabase = await supabaseSession();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, city, neighborhood, owner_id")
    .ilike("name", `%${texto}%`)
    .limit(20);

  if (error) {
    console.error("buscar fichas", error.message);
    return {
      status: "error",
      message: "No pudimos buscar ahora. Inténtalo otra vez.",
      resultados: [],
    };
  }

  // Una ficha con dueño ya no se reclama; se muestra para que quien busca
  // entienda por qué no aparece, en vez de creer que no existe.
  return {
    status: "ok",
    message: "",
    resultados: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      lugar: [r.neighborhood, r.city].filter(Boolean).join(" · "),
      reclamado: r.owner_id !== null,
    })),
  };
}

export async function reclamarFicha(_prevState, formData) {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const evidencia = String(formData.get("evidence") ?? "").trim();

  if (!restaurantId) {
    return { status: "error", message: "Elige un restaurante de la lista." };
  }
  if (evidencia.length < 20) {
    return {
      status: "error",
      message:
        "Cuéntanos con un poco más de detalle cómo podemos verificar que el negocio es tuyo.",
    };
  }

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { status: "error", message: "Tu sesión expiró. Vuelve a entrar." };
  }

  const { error } = await supabase.from("restaurant_claims").insert({
    restaurant_id: restaurantId,
    claimant_id: auth.user.id,
    evidence: evidencia,
  });

  if (error) {
    // 23505 es el índice único de solicitudes pendientes: ya hay una en curso.
    if (error.code === "23505") {
      return {
        status: "ok",
        message: "Ya tienes una solicitud en curso para ese restaurante.",
      };
    }
    console.error("reclamar ficha", error.message);
    return {
      status: "error",
      message: "No pudimos registrar la solicitud. Inténtalo otra vez.",
    };
  }

  revalidatePath("/reclamar");
  return {
    status: "ok",
    message:
      "Solicitud enviada. La revisamos y te escribimos al correo de tu cuenta.",
  };
}
