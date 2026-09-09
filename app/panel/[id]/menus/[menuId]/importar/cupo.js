import { lecturasIncluidas } from "../../../../../../lib/extraccion";

// Cuántas lecturas van este mes contra cuántas incluye el plan. La función de
// la base cuenta bajo la RLS del dueño, así que solo ve las suyas. Vive aparte
// de las acciones porque un archivo "use server" solo puede exportar acciones,
// y esto es un cálculo que la página y las acciones comparten.
export async function cupoDeLecturas(supabase, restaurante) {
  const { data } = await supabase.rpc("extracciones_del_mes", { rid: restaurante.id });
  const usadas = Number(data ?? 0);
  const incluidas = lecturasIncluidas(restaurante);
  return { usadas, incluidas, quedan: Math.max(0, incluidas - usadas) };
}
