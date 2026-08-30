import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

// El cliente vive del lado del servidor y usa la llave publicable, no la de
// servicio: aunque se filtrara, las políticas RLS solo le permiten insertar en
// waitlist. Nada de esto debe importarse desde un componente del navegador.
export function supabaseServer() {
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
