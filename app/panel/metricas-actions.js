"use server";

import { supabaseSession } from "../../lib/supabase";

// El tablero pide las métricas cuando el dueño cambia de periodo o de
// restaurante. Es una acción de servidor y no una ruta de API porque no la
// llama nadie más: la sesión ya viaja en las cookies y la función de la base
// comprueba que quien pregunta sea el dueño.
export async function metricasDe(restauranteId, periodo) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { error: "sesion" };

  const { data, error } = await supabase.rpc("restaurant_metrics", {
    rid: restauranteId,
    periodo,
  });

  if (error) {
    console.error("metricas", error.message);
    return { error: "consulta" };
  }

  return { datos: data };
}
