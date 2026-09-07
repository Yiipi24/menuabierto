"use server";

import { supabaseSession } from "../../lib/supabase";
import { combinaMetricas } from "../../lib/metricas";

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

/**
 * Las métricas de la selección del filtro: uno, varios o todos.
 *
 * La función de la base contesta por un restaurante, así que se le pregunta
 * por todos a la vez y se suman aquí (lib/metricas.js). Van en paralelo porque
 * son consultas independientes y el dueño está esperando la pantalla.
 */
export async function metricasDeSeleccion(ids, periodo) {
  const lista = (ids ?? []).filter(Boolean);
  if (lista.length === 0) return { datos: null };
  if (lista.length === 1) return metricasDe(lista[0], periodo);

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { error: "sesion" };

  const respuestas = await Promise.all(
    lista.map((rid) => supabase.rpc("restaurant_metrics", { rid, periodo })),
  );

  const fallo = respuestas.find((r) => r.error);
  if (fallo) {
    console.error("metricas", fallo.error.message);
    return { error: "consulta" };
  }

  return { datos: combinaMetricas(respuestas.map((r) => r.data)) };
}
