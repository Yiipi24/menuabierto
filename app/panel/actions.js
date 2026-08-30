"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../lib/supabase";

export async function cerrarSesion() {
  const supabase = await supabaseSession();
  await supabase.auth.signOut();
  redirect("/entrar");
}

// Convierte "Taquería La Esquina" en "taqueria-la-esquina".
function aSlug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

  const base = aSlug(nombre) || "restaurante";
  // Sufijo corto para que dos taquerías con el mismo nombre no choquen. El
  // índice único de la base sigue siendo la garantía final.
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;

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
    console.error("crear restaurante", error.message);
    return {
      status: "error",
      message: "No pudimos guardar el restaurante. Inténtalo otra vez.",
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
  redirect("/panel");
}
