#!/usr/bin/env node
// Conectar el número de WhatsApp de un restaurante a su asistente.
//
//   npm run whatsapp                                        # lista los números conectados
//   npm run whatsapp -- conectar <slug> <phone_number_id> <número> [--waba <id>] [--app]
//   npm run whatsapp -- pausar <slug>
//   npm run whatsapp -- reanudar <slug>
//   npm run whatsapp -- desconectar <slug>
//
// `phone_number_id` y el id de la cuenta (WABA) salen del panel de Meta, en
// WhatsApp › Configuración de la API, una vez que el número del restaurante
// está en la Cloud API. `--app` marca que el restaurante sigue contestando
// desde la app de WhatsApp Business en el mismo número (coexistencia): solo
// entonces "hablar con alguien" calla al asistente.
//
// Necesita SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: la tabla de números solo
// la escribe la llave de servicio, porque quien pudiera apuntar un número a su
// ficha podría quedarse con los mensajes de otro. Con WHATSAPP_TOKEN, además,
// comprueba el número contra Meta y, con `--waba`, suscribe la aplicación a
// los mensajes de esa cuenta.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const supabase = createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } });

const token = process.env.WHATSAPP_TOKEN;
const version = /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_VERSION ?? "")
  ? process.env.WHATSAPP_GRAPH_VERSION
  : "v24.0";

const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : null;
};
const [accion, slug, phoneNumberId, numero] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--waba");

// La misma regla que `telefonoWhatsapp` en lib/whatsapp.js: solo dígitos, con
// lada, sin el "1" viejo de los celulares mexicanos.
function telefono(bruto) {
  const d = String(bruto ?? "").replace(/\D/g, "");
  const sinUno = d.length === 13 && d.startsWith("521") ? `52${d.slice(3)}` : d;
  const conLada = sinUno.length === 10 ? `52${sinUno}` : sinUno;
  return conLada.length >= 11 && conLada.length <= 15 ? conLada : null;
}

async function graph(ruta, metodo = "GET") {
  const r = await fetch(`https://graph.facebook.com/${version}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}` },
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(datos?.error?.message ?? `Meta ${r.status}`);
  return datos;
}

async function restaurante(s) {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, status, whatsapp_orders, whatsapp_phone")
    .eq("slug", String(s ?? ""))
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    console.error(`No hay ninguna ficha con el slug "${s}".`);
    process.exit(1);
  }
  return data;
}

if (!accion) {
  const { data, error } = await supabase
    .from("whatsapp_lines")
    .select("phone_number_id, display_phone, is_active, answers_in_app, created_at, restaurants (name, slug)")
    .order("created_at");
  if (error) throw error;
  if (!data?.length) {
    console.log("No hay ningún número conectado.");
    process.exit(0);
  }
  for (const l of data) {
    console.log(
      `${l.restaurants?.slug} · ${l.restaurants?.name} · +${l.display_phone} · id ${l.phone_number_id}` +
        `${l.is_active ? "" : " · PAUSADO"}${l.answers_in_app ? " · contestan en la app" : ""}`,
    );
  }
  process.exit(0);
}

if (accion === "conectar") {
  const display = telefono(numero);
  if (!slug || !/^[0-9]{5,30}$/.test(phoneNumberId ?? "") || !display) {
    console.error("Uso: npm run whatsapp -- conectar <slug> <phone_number_id> <número> [--waba <id>] [--app]");
    process.exit(2);
  }
  const waba = opcion("--waba");
  if (waba && !/^[0-9]{5,30}$/.test(waba)) {
    console.error("El id de la cuenta (--waba) son solo dígitos.");
    process.exit(2);
  }
  const r = await restaurante(slug);
  if (r.status !== "publicado") {
    console.warn(`Aviso: la ficha está en "${r.status}". El asistente no contesta hasta que se publique.`);
  }

  // Con el token, el número se comprueba contra Meta antes de guardarlo: un
  // id copiado mal apuntaría los mensajes de un restaurante a la ficha de otro.
  if (token) {
    const numeroEnMeta = await graph(`/${phoneNumberId}?fields=display_phone_number,verified_name`);
    const enMeta = telefono(numeroEnMeta.display_phone_number);
    if (enMeta !== display) {
      console.error(`Meta dice que ese id es el +${enMeta} (${numeroEnMeta.verified_name}), no el +${display}.`);
      process.exit(1);
    }
    console.log(`Meta confirma: +${enMeta} · ${numeroEnMeta.verified_name}`);
  } else {
    console.warn("Sin WHATSAPP_TOKEN no se comprueba el número contra Meta.");
  }

  const { error } = await supabase.from("whatsapp_lines").insert({
    phone_number_id: phoneNumberId,
    restaurant_id: r.id,
    display_phone: display,
    waba_id: waba,
    answers_in_app: args.includes("--app"),
  });
  if (error) {
    console.error(
      error.code === "23505"
        ? "Ese número o esa ficha ya tienen un asistente conectado. Revisa con `npm run whatsapp`."
        : error.message,
    );
    process.exit(1);
  }

  // Los pedidos que arma la carta de la ficha van al número de WhatsApp de la
  // ficha. Para que pasen por el asistente, tiene que ser este.
  if (r.whatsapp_phone !== display) {
    const { error: sinNumero } = await supabase.from("restaurants").update({ whatsapp_phone: display }).eq("id", r.id);
    if (sinNumero) throw sinNumero;
    console.log(`El número de pedidos de la ficha pasó de ${r.whatsapp_phone ? `+${r.whatsapp_phone}` : "(ninguno)"} a +${display}.`);
  }

  if (waba && token) {
    await graph(`/${waba}/subscribed_apps`, "POST");
    console.log(`La aplicación quedó suscrita a los mensajes de la cuenta ${waba}.`);
  } else if (waba) {
    console.warn("Sin WHATSAPP_TOKEN no se pudo suscribir la aplicación a la cuenta; hazlo desde el panel de Meta.");
  }

  console.log(`Listo: el asistente de ${r.name} contesta en el +${display}.`);
  if (!r.whatsapp_orders) {
    console.log("Los pedidos están apagados en la ficha: el asistente contesta preguntas pero no toma pedidos hasta que el dueño los prenda en su panel.");
  }
  process.exit(0);
}

if (["pausar", "reanudar", "desconectar"].includes(accion)) {
  const r = await restaurante(slug);
  const consulta =
    accion === "desconectar"
      ? supabase.from("whatsapp_lines").delete({ count: "exact" }).eq("restaurant_id", r.id)
      : supabase.from("whatsapp_lines").update({ is_active: accion === "reanudar" }, { count: "exact" }).eq("restaurant_id", r.id);
  const { error, count } = await consulta;
  if (error) throw error;
  if (!count) {
    console.error(`${r.name} no tiene ningún número conectado.`);
    process.exit(1);
  }
  console.log(
    accion === "pausar"
      ? `El asistente de ${r.name} quedó pausado: no contesta hasta que se reanude.`
      : accion === "reanudar"
        ? `El asistente de ${r.name} vuelve a contestar.`
        : `El número de ${r.name} quedó desconectado. Sus pedidos se conservan.`,
  );
  process.exit(0);
}

console.error("Uso: npm run whatsapp -- [conectar|pausar|reanudar|desconectar] <slug> …");
process.exit(2);
