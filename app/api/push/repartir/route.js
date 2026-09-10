import { repartirPush, pushConfigurado } from "../../../../lib/push";

// La red de seguridad del reparto: lo que las acciones no alcanzaron a mandar
// —publicaciones programadas, un fallo momentáneo— sale por aquí cada pocos
// minutos (vercel.json). Solo con el secreto del cron, que Vercel manda como
// Bearer; sin él, nadie puede disparar envíos desde fuera.
export const dynamic = "force-dynamic";

export async function GET(request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return new Response(null, { status: 401 });
  }
  if (!pushConfigurado()) return Response.json({ ok: true, configurado: false });
  const enviados = await repartirPush();
  return Response.json({ ok: true, enviados });
}
