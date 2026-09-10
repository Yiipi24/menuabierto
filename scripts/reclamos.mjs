#!/usr/bin/env node
// Revisar y resolver reclamos de fichas a mano.
//
//   node scripts/reclamos.mjs                 # lista los pendientes
//   node scripts/reclamos.mjs aprobar <id>    # asigna la ficha a quien reclamó
//   node scripts/reclamos.mjs rechazar <id>
//
// Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: resolver un reclamo es
// mover owner_id, y eso solo lo hace la llave de servicio (ver la función
// aprobar_reclamo en la base). Los reclamos cuyo correo coincide con el
// dominio del sitio del restaurante se aprueban solos al enviarse; aquí llegan
// los demás.

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
    .from("restaurant_claims")
    .select("id, created_at, evidence, claimant_id, restaurants (name, city, neighborhood, website, phone)")
    .eq("status", "pendiente")
    .order("created_at");
  if (error) throw error;
  if (!data?.length) {
    console.log("No hay reclamos pendientes.");
    process.exit(0);
  }
  for (const c of data) {
    const { data: usuario } = await supabase.auth.admin.getUserById(c.claimant_id);
    console.log(`\n${c.id}`);
    console.log(`  ${c.restaurants?.name} · ${[c.restaurants?.neighborhood, c.restaurants?.city].filter(Boolean).join(", ")}`);
    console.log(`  Ficha: tel ${c.restaurants?.phone ?? "—"} · sitio ${c.restaurants?.website ?? "—"}`);
    console.log(`  Reclama: ${usuario?.user?.email ?? c.claimant_id} · ${new Date(c.created_at).toLocaleString("es-MX")}`);
    console.log(`  Dice: ${c.evidence}`);
  }
  process.exit(0);
}

if (!["aprobar", "rechazar"].includes(accion) || !id) {
  console.error("Uso: node scripts/reclamos.mjs [aprobar|rechazar] <id>");
  process.exit(2);
}

const { error } = await supabase.rpc(accion === "aprobar" ? "aprobar_reclamo" : "rechazar_reclamo", {
  p_claim: id,
});
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(accion === "aprobar" ? "Reclamo aprobado: la ficha ya es de quien la reclamó." : "Reclamo rechazado.");
