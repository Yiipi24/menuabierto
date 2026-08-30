import { supabaseServer } from "../../../lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = new Set(["comensal", "restaurante"]);
const GENERIC_ERROR = "No pudimos guardar tu correo. Inténtalo otra vez.";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  const email = String(payload?.email ?? "").trim().toLowerCase();
  const role = String(payload?.role ?? "comensal");
  // Trampa para bots: el formulario deja este campo vacío y oculto.
  const trap = String(payload?.company ?? "").trim();

  if (!EMAIL.test(email) || email.length > 254) {
    return Response.json({ error: "Ese correo no se ve bien." }, { status: 400 });
  }
  if (!ROLES.has(role)) {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }
  // Un bot que llenó la trampa recibe el mismo "listo" que una persona, para
  // que no aprenda a evitarla. Simplemente no guardamos nada.
  if (trap) {
    return Response.json({ ok: true });
  }

  try {
    const { error } = await supabaseServer()
      .from("waitlist")
      .insert({ email, role });

    // 23505 es la violacion de unicidad: el correo ya estaba en la lista, que
    // para quien envia el formulario es exito. No usamos upsert ni ON CONFLICT
    // porque bajo RLS exigirian una politica de select, y entonces la llave
    // publicable podria leer la lista entera de correos.
    if (error && error.code !== "23505") {
      console.error("waitlist insert failed", error.message);
      return Response.json({ error: GENERIC_ERROR }, { status: 502 });
    }
  } catch (cause) {
    console.error("waitlist unavailable", cause.message);
    return Response.json({ error: GENERIC_ERROR }, { status: 502 });
  }

  // Un correo repetido responde igual que uno nuevo: quien envía el formulario
  // no tiene por qué averiguar si una dirección ajena ya está registrada.
  return Response.json({ ok: true });
}
