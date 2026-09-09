#!/usr/bin/env node
// La cola de reseñas reportadas.
//
//   npm run reportes                      # lista los pendientes
//   npm run reportes -- conservar <id>    # la reseña se queda; se cierra el reporte
//   npm run reportes -- retirar <id>      # se borra la reseña (y el promedio se recalcula)
//
// Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: resolver un reporte es
// borrar la reseña de alguien, y eso no lo hace ningún usuario. No hay
// moderación automática a propósito: una reseña reportada sigue visible hasta
// que una persona la mira.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const supabase = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

const [accion, id] = process.argv.slice(2);

if (!accion) {
  const { data, error } = await supabase
    .from("review_reports")
    .select("id, reason, detail, created_at, reporter_id, reviews (rating, body, author_id, created_at), restaurants (name, owner_id)")
    .eq("status", "pendiente")
    .order("created_at");
  if (error) throw error;
  if (!data?.length) {
    console.log("No hay reportes pendientes.");
    process.exit(0);
  }
  for (const rp of data) {
    const quien = rp.reporter_id === rp.restaurants?.owner_id ? "el dueño" : "un comensal";
    console.log(`\n${rp.id}  (${rp.reason}, reportada por ${quien}, ${new Date(rp.created_at).toLocaleString("es-MX")})`);
    console.log(`  ${rp.restaurants?.name} · ${rp.reviews?.rating ?? "?"}★ · ${new Date(rp.reviews?.created_at ?? rp.created_at).toLocaleDateString("es-MX")}`);
    console.log(`  Reseña: ${rp.reviews?.body ?? "(sin texto)"}`);
    if (rp.detail) console.log(`  Detalle del reporte: ${rp.detail}`);
  }
  process.exit(0);
}

if (!["conservar", "retirar"].includes(accion) || !id) {
  console.error("Uso: npm run reportes -- [conservar|retirar] <id>");
  process.exit(2);
}

const { error } = await supabase.rpc("resolver_reporte", { p_report: id, p_accion: accion });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(accion === "retirar" ? "Reseña retirada." : "Reseña conservada; reporte cerrado.");
