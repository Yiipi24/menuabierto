import { supabaseSession } from "../../lib/supabase";
import { POR_PAGINA, POR_PAGINA_FEED, urlDeMedia } from "../../lib/social";

// Lo social de una ficha. Va aparte de `_ficha/datos` porque `cargar` corre con
// el cliente anónimo —la ficha es pública y se cachea igual para todos— y esto
// depende de quién mira: si sigo el restaurante, si ya di like, si vi la
// historia. Mezclarlo allá habría convertido toda la carga de la ficha en algo
// distinto por persona.

/**
 * Historias, publicaciones y el estado de mi relación con la ficha.
 *
 * Se usa el cliente con sesión aunque no haya sesión: sin cookies se comporta
 * como el anónimo y las funciones ya devuelven lo que un visitante puede ver,
 * con `me_gusta` y `vista` en falso. Así la ficha pública y la de quien entró
 * recorren el mismo camino.
 */
export async function cargarSocial(restauranteId, usuarioId) {
  const supabase = await supabaseSession();

  const [historias, publicaciones, seguimiento] = await Promise.all([
    supabase.rpc("historias_restaurante", { rid: restauranteId }),
    supabase.rpc("publicaciones_restaurante", {
      rid: restauranteId,
      limite: POR_PAGINA,
      antes: null,
    }),
    // El seguimiento propio es de la tabla y no de una función: la política ya
    // limita la lectura a la fila de quien pregunta.
    usuarioId
      ? supabase
          .from("restaurant_followers")
          .select("notify_stories")
          .eq("profile_id", usuarioId)
          .eq("restaurant_id", restauranteId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Un fallo aquí no puede tumbar la ficha: los horarios, el menú y la
  // dirección son lo que la persona vino a ver, y se siguen viendo aunque la
  // parte social no cargue.
  if (historias.error) console.error("historias", historias.error.message);
  if (publicaciones.error) console.error("publicaciones", publicaciones.error.message);

  const conUrl = (fila) => ({ ...fila, url: urlDeMedia(supabase, fila.media_path) });

  return {
    historias: (historias.data ?? []).map(conUrl),
    publicaciones: (publicaciones.data ?? []).map(conUrl),
    // Si vino la página completa, es probable que haya más. Preguntarlo con un
    // `count` exacto costaría otra consulta para adornar un botón.
    hayMasPublicaciones: (publicaciones.data ?? []).length >= POR_PAGINA,
    sigo: Boolean(seguimiento.data),
    alerta: Boolean(seguimiento.data?.notify_stories),
  };
}

/**
 * El feed del comensal. Devuelve las historias agrupadas por restaurante —así
 * es como se miran— y las publicaciones en una sola lista por fecha.
 */
export async function cargarFeed(antes = null) {
  const supabase = await supabaseSession();

  // Lo programado que ya salió reparte aquí sus avisos. El feed es el sitio
  // con más tráfico de todo lo social y es justo donde el aviso importa, así
  // que llegar tarde por unos minutos es lo peor que puede pasar: la pieza en
  // sí ya se ve sola, porque las lecturas la filtran por su hora de salida.
  await repartirProgramadas(supabase);

  // El doble de una página: entre lo que llega hay historias, que no ocupan
  // sitio en la lista de publicaciones sino un círculo arriba.
  const limite = POR_PAGINA_FEED * 2;
  const { data, error } = await supabase.rpc("feed_seguidos", { limite, antes });

  if (error) {
    console.error("feed", error.message);
    return { historias: [], publicaciones: [], hayMas: false, error: true };
  }

  const filas = (data ?? []).map((f) => ({ ...f, url: urlDeMedia(supabase, f.media_path) }));

  // Las historias se agrupan por restaurante: cinco círculos de un mismo local
  // en fila serían cinco veces el mismo nombre.
  const porRestaurante = new Map();
  for (const f of filas.filter((x) => x.kind === "historia")) {
    const grupo = porRestaurante.get(f.restaurant_id) ?? {
      id: f.restaurant_id,
      nombre: f.restaurant_name,
      slug: f.restaurant_slug,
      historias: [],
    };
    grupo.historias.push(f);
    porRestaurante.set(f.restaurant_id, grupo);
  }

  // Dentro de cada restaurante van de la más vieja a la más nueva, que es el
  // orden en el que se miran; entre restaurantes manda quién publicó al final.
  const historias = [...porRestaurante.values()].map((g) => ({
    ...g,
    historias: g.historias.slice().reverse(),
  }));

  return {
    historias,
    publicaciones: filas.filter((f) => f.kind === "publicacion"),
    hayMas: filas.length >= limite,
    error: false,
  };
}

// A quién sigo, para el estado vacío y para la pantalla de preferencias.
export async function misSeguidos() {
  const supabase = await supabaseSession();
  const { data, error } = await supabase
    .from("restaurant_followers")
    .select("restaurant_id, notify_stories, created_at, restaurants (id, name, slug, city)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("seguidos", error.message);
    return [];
  }

  return (data ?? [])
    .filter((f) => f.restaurants)
    .map((f) => ({
      id: f.restaurant_id,
      nombre: f.restaurants.name,
      slug: f.restaurants.slug,
      ciudad: f.restaurants.city,
      alerta: f.notify_stories,
    }));
}

export async function misAvisos() {
  const supabase = await supabaseSession();
  const { data, error } = await supabase.rpc("mis_avisos", { limite: 30 });
  if (error) {
    console.error("avisos", error.message);
    return [];
  }
  return (data ?? []).map((a) => ({ ...a, url: urlDeMedia(supabase, a.media_path) }));
}

// Cuántos avisos sin leer. Es el punto rojo del menú, así que se pide en cada
// página con sesión: una sola cuenta sobre un índice parcial.
export async function avisosSinLeer(usuarioId) {
  if (!usuarioId) return 0;
  const supabase = await supabaseSession();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", usuarioId)
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

// El reparto de los avisos de lo programado cuya hora ya pasó. La pieza no
// depende de esto para verse —eso lo hace el filtro por `publish_at` de cada
// lectura—, solo la campana de quien la sigue. Como la barredora de historias,
// corre desde donde hay tráfico y nunca puede estorbar a la página.
export async function repartirProgramadas(cliente = null) {
  try {
    const supabase = cliente ?? (await supabaseSession());
    await supabase.rpc("repartir_avisos_programados");
    // Lo que acaba de repartirse a la bandeja sale también por push.
    const { repartirPushDeAventon } = await import("../../lib/push");
    repartirPushDeAventon();
  } catch {
    // Un fallo aquí retrasa un aviso hasta la siguiente visita, nada más.
  }
}

// La limpieza de las historias caducadas. Se llama desde la carga de la ficha
// —de vez en cuando, no siempre— porque es ahí donde hay tráfico y porque no
// hace falta un cron para borrar filas que las lecturas ya esconden.
//
// Solo con sesión: la función está concedida a `authenticated` y no a `anon`.
// Borrar filas, aunque sean filas que nadie puede ver desde hace una semana, no
// es algo que deba poder disparar quien solo abrió una página.
export async function recogerHistoriasViejas(usuarioId) {
  // Una de cada cincuenta visitas. La barredora borra lo caducado hace más de
  // una semana, así que llegar tarde no tiene consecuencias.
  if (!usuarioId || Math.random() > 0.02) return;
  try {
    const supabase = await supabaseSession();
    await supabase.rpc("limpiar_historias");
  } catch {
    // Nunca puede estorbar a la ficha.
  }
}
