#!/usr/bin/env node
// Siembra fichas no reclamadas desde un CSV del DENUE (INEGI).
//
//   node scripts/sembrar-denue.mjs --archivo denue_19.csv [--municipio Monterrey]
//        [--limite 500] [--simular] [--codificacion latin1]
//
// El CSV se descarga de https://www.inegi.org.mx/app/descarga/?ti=6 (DENUE,
// por entidad) o del mapa del DENUE filtrando "Servicios de preparación de
// alimentos". Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: escribe con la
// llave de servicio porque estas fichas no las da de alta ningún usuario.
//
// Es idempotente: el índice único (source, source_id) hace que un registro ya
// sembrado se salte, y `ficha_duplicada` evita sembrar encima de un local que
// ya está —porque el DENUE lo trae dos veces o porque su dueño ya lo publicó.
// Se puede correr todas las veces que haga falta y solo entra lo nuevo.

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { fichaDesdeFila, leerCsv } from "../lib/denue.js";
import { slugDisponible } from "../lib/slug.js";

function argumentos(argv) {
  const opciones = { simular: false, limite: Infinity, codificacion: "utf-8", municipio: null, archivo: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--simular") opciones.simular = true;
    else if (a === "--archivo") opciones.archivo = argv[++i];
    else if (a === "--municipio") opciones.municipio = argv[++i];
    else if (a === "--limite") opciones.limite = Number(argv[++i]);
    else if (a === "--codificacion") opciones.codificacion = argv[++i];
  }
  if (!opciones.archivo) {
    console.error("Uso: node scripts/sembrar-denue.mjs --archivo <csv> [--municipio X] [--limite N] [--simular] [--codificacion latin1]");
    process.exit(2);
  }
  return opciones;
}

function normal(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  const opciones = argumentos(process.argv.slice(2));

  const url = process.env.SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!opciones.simular && (!url || !llave)) {
    console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }

  const bytes = await readFile(opciones.archivo);
  const texto = new TextDecoder(opciones.codificacion).decode(bytes);
  const filas = leerCsv(texto);
  console.log(`Filas en el CSV: ${filas.length}`);

  let fichas = filas.map(fichaDesdeFila).filter(Boolean);
  if (opciones.municipio) {
    const buscado = normal(opciones.municipio);
    fichas = fichas.filter((f) => normal(f.city) === buscado);
  }
  console.log(`Restaurantes que pasan el filtro: ${fichas.length}`);

  const supabase = opciones.simular
    ? null
    : createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

  // Lo que ya está, de una vez, para no preguntar fila por fila.
  const yaSembrados = new Set();
  const cocinas = new Map();
  if (supabase) {
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase
        .from("restaurants")
        .select("source_id")
        .eq("source", "denue")
        .range(desde, desde + 999);
      if (error) throw error;
      for (const r of data ?? []) yaSembrados.add(r.source_id);
      if (!data || data.length < 1000) break;
    }
    const { data: catalogo, error } = await supabase.from("cuisines").select("id, slug");
    if (error) throw error;
    for (const c of catalogo ?? []) cocinas.set(c.slug, c.id);
  }

  const cuenta = { nuevas: 0, repetidas: 0, duplicadas: 0, errores: 0 };
  let procesadas = 0;

  for (const f of fichas) {
    if (procesadas >= opciones.limite) break;
    procesadas += 1;

    if (yaSembrados.has(f.source_id)) {
      cuenta.repetidas += 1;
      continue;
    }

    if (opciones.simular) {
      console.log(`+ ${f.name} · ${f.neighborhood ?? "—"}, ${f.city} · ${f.cocina ?? "sin cocina"}`);
      cuenta.nuevas += 1;
      continue;
    }

    // Un local que ya está —del DENUE con otra razón social, o publicado por
    // su dueño— no se siembra encima.
    if (f.lat != null && f.lng != null) {
      const { data: choca, error } = await supabase.rpc("ficha_duplicada", {
        p_nombre: f.name,
        p_lat: f.lat,
        p_lng: f.lng,
        p_radio_m: 150,
      });
      if (error) throw error;
      if (choca) {
        cuenta.duplicadas += 1;
        continue;
      }
    }

    const slug = await slugDisponible(f.name, f.neighborhood, async (candidato) => {
      const { data } = await supabase.from("restaurants").select("id").eq("slug", candidato).maybeSingle();
      return Boolean(data);
    });

    const { data: creada, error } = await supabase
      .from("restaurants")
      .insert({
        slug,
        name: f.name,
        street: f.street,
        neighborhood: f.neighborhood,
        city: f.city,
        state: f.state,
        postal_code: f.postal_code,
        phone: f.phone,
        website: f.website,
        location: f.lat != null && f.lng != null ? `SRID=4326;POINT(${f.lng} ${f.lat})` : null,
        // Publicada desde el inicio: es lo que hace que la búsqueda tenga algo
        // que enseñar. Sin dueño, que es lo que la marca como no reclamada.
        status: "publicado",
        owner_id: null,
        created_by: null,
        source: f.source,
        source_id: f.source_id,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 en (source, source_id): otra corrida la sembró al mismo tiempo.
      if (error.code === "23505") {
        cuenta.repetidas += 1;
      } else {
        cuenta.errores += 1;
        console.error(`x ${f.name}: ${error.message}`);
      }
      continue;
    }

    if (f.cocina && cocinas.has(f.cocina)) {
      const { error: errorCocina } = await supabase
        .from("restaurant_cuisines")
        .insert({ restaurant_id: creada.id, cuisine_id: cocinas.get(f.cocina) });
      if (errorCocina) console.error(`  cocina de ${f.name}: ${errorCocina.message}`);
    }

    cuenta.nuevas += 1;
    if (cuenta.nuevas % 100 === 0) console.log(`… ${cuenta.nuevas} sembradas`);
  }

  console.log(
    `${opciones.simular ? "(simulación) " : ""}Nuevas: ${cuenta.nuevas} · Ya estaban: ${cuenta.repetidas} · Duplicadas por nombre y cercanía: ${cuenta.duplicadas} · Errores: ${cuenta.errores}`,
  );
  if (!opciones.simular && cuenta.nuevas > 0) {
    console.log("Las páginas de /comida y el sitemap se recalculan solas en un día; para verlas antes, despliega o tira la etiqueta `rutas`.");
  }
  process.exit(cuenta.errores ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
