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
  requireConfig();
  const store = await cookies();

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
