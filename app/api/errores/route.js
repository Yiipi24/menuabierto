import { reportarError } from "../../../lib/errores";

// Los errores del navegador —los que atrapa error.js— no pasan por el
// servidor, así que la pantalla de error los manda aquí. Se acepta poco y se
// recorta todo: cualquiera puede llamar a esta ruta, y lo único que puede
// conseguir es un renglón en el canal de errores.
export const dynamic = "force-dynamic";

export async function POST(request) {
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const mensaje = String(cuerpo?.mensaje ?? "").slice(0, 400);
  if (!mensaje) return new Response(null, { status: 400 });

  await reportarError(
    { message: mensaje, stack: String(cuerpo?.pila ?? "").slice(0, 1500), digest: cuerpo?.digest },
    { ruta: String(cuerpo?.ruta ?? "").slice(0, 200), tipo: "navegador" },
  );
  return new Response(null, { status: 204 });
}
