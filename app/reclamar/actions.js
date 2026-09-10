"use server";

import { revalidatePath } from "next/cache";
import { supabaseServicio, supabaseSession } from "../../lib/supabase";
import { correoDemuestraElSitio } from "../../lib/reclamos";
import { invalidarFicha } from "../../lib/cache";
import { uuidValido } from "../../lib/slug";

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

  const { data: reclamo, error } = await supabase
    .from("restaurant_claims")
    .insert({
      restaurant_id: restaurantId,
      claimant_id: auth.user.id,
      evidence: evidencia,
    })
    .select("id")
    .single();

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

  // Si el correo de la cuenta es del dominio del sitio que el restaurante
  // tiene registrado, no hay nada que revisar a mano: se aprueba aquí mismo y
  // la ficha pasa a su panel. Lo demás se queda pendiente para revisarlo con
  // `scripts/reclamos.mjs`. Un fallo en este atajo no rompe la solicitud: se
  // queda pendiente, que es lo que ya era.
  const aprobado = await aprobarSiElCorreoLoDemuestra(supabase, reclamo?.id, restaurantId, auth.user.email);

  revalidatePath("/reclamar");
  if (aprobado) {
    return {
      status: "ok",
      aprobado: true,
      message:
        "Listo: tu correo es del mismo dominio que el sitio del restaurante, así que la ficha ya es tuya. La encuentras en tu panel.",
    };
  }
  return {
    status: "ok",
    message:
      "Solicitud enviada. La revisamos y te escribimos al correo de tu cuenta.",
  };
}

async function aprobarSiElCorreoLoDemuestra(supabase, claimId, restaurantId, correo) {
  if (!claimId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const { data: ficha } = await supabase
      .from("restaurants")
      .select("slug, website")
      .eq("id", restaurantId)
      .maybeSingle();
    if (!ficha || !correoDemuestraElSitio(correo, ficha.website)) return false;

    const { error } = await supabaseServicio().rpc("aprobar_reclamo", { p_claim: claimId });
    if (error) {
      console.error("aprobar reclamo por dominio", error.message);
      return false;
    }
    invalidarFicha(ficha.slug);
    revalidatePath("/panel");
    return true;
  } catch (fallo) {
    console.error("aprobar reclamo por dominio", fallo?.message);
    return false;
  }
}

// La ficha que trae `/reclamar?ficha=<id>` desde el aviso de una ficha no
// reclamada, para que la persona no tenga que buscarla otra vez. Solo se
// ofrece si existe y no tiene dueño.
export async function fichaParaReclamar(id) {
  if (!uuidValido(id)) return null;
  const supabase = await supabaseSession();
  const { data } = await supabase
    .from("restaurants")
    .select("id, name, city, neighborhood, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.owner_id !== null) return null;
  return {
    id: data.id,
    name: data.name,
    lugar: [data.neighborhood, data.city].filter(Boolean).join(" · "),
    reclamado: false,
  };
}
