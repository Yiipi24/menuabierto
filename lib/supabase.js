import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

function requireConfig() {
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY.");
  }
}

// Cliente sin sesión, para lo que cualquier visitante puede hacer: la lista de
// espera y, más adelante, la búsqueda pública del directorio.
export function supabaseServer() {
  requireConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Cliente ligado a las cookies de la petición. Todo el manejo de sesión vive
// en el servidor: el navegador nunca ve la llave ni los tokens, solo cookies
// httpOnly que no puede leer el JavaScript de la página.
export async function supabaseSession() {
  // Las cookies se leen antes de mirar la configuración, y el orden importa:
  // tocarlas es lo que le dice a Next que esta página depende de quién la
  // pide y no se puede prerenderizar. Al revés, una compilación sin las
  // variables de Supabase reventaba al generar /avisos en vez de marcarla
  // dinámica, que es lo que de verdad es.
  const store = await cookies();
  requireConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(items) {
        try {
          for (const { name, value, options } of items) {
            store.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies. No es un problema:
          // el middleware ya refrescó la sesión antes de llegar aquí.
        }
      },
    },
  });
}

// Quién está firmado, o null. Usa getUser y no getSession a propósito:
// getUser valida el token contra Supabase, mientras que getSession se fía de
// la cookie, que el navegador podría haber alterado.
export async function currentUser() {
  const supabase = await supabaseSession();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

// Supabase devuelve 1000 filas como máximo por consulta, así que lo que
// recorre una tabla entera —el sitemap, el catálogo de /comida— la pide por
// páginas. El tope está para que un error de arriba no se convierta en un
// bucle que recorre la base para siempre.
//
// El orden de la consulta tiene que ser estable entre una página y la
// siguiente: con uno que cambia, una fila puede salir dos veces y otra no
// salir nunca.
const PAGINA = 1000;
const TOPE = 40000;

export async function todasLasFilas(consulta) {
  const filas = [];
  for (let desde = 0; desde < TOPE; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw error;
    if (!data?.length) break;
    filas.push(...data);
    if (data.length < PAGINA) break;
  }
  return filas;
}

// Cliente con la llave de servicio: se salta la RLS, así que solo se usa donde
// no hay usuario que represente a nadie —el webhook de la pasarela— o donde la
// escritura es del sistema y no del dueño, como mover el plan de una ficha.
// La llave no existe en el navegador ni en el middleware: si falta, revienta
// aquí y no en silencio más adelante.
export function supabaseServicio() {
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servicio) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, servicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
