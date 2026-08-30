const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = new Set(["comensal", "restaurante"]);

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  const email = String(payload?.email ?? "").trim().toLowerCase();
  const role = String(payload?.role ?? "comensal");

  if (!EMAIL.test(email)) {
    return Response.json({ error: "Ese correo no se ve bien." }, { status: 400 });
  }
  if (!ROLES.has(role)) {
    return Response.json({ error: "Petición inválida." }, { status: 400 });
  }

  // Pendiente: escribir en la base de datos. Por ahora queda en los logs de Vercel.
  console.log("waitlist", JSON.stringify({ email, role, at: new Date().toISOString() }));

  return Response.json({ ok: true });
}
