// Mandar los avisos por push web. Solo en el servidor: la llave privada VAPID
// firma cada envío y no sale de las variables de entorno.
//
// No hay cola ni cron en la base: los avisos nacen en `notifications` (por
// triggers y funciones) y aquí se recogen los que aún no salieron
// (`pushed_at` nulo). Se llama desde las acciones que crean avisos —de
// aventón, sin esperar— y desde /api/push/repartir cada pocos minutos por si
// alguno quedó, por ejemplo los de publicaciones programadas.

import webpush from "web-push";
import { supabaseServicio } from "./supabase";
import { pushPermitido, textoDePush } from "./avisos";
import { urlDelSitio } from "./sitio";

export function pushConfigurado() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function configurar() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:hola@menuabierto.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

const LOTE = 200;
const VENTANA_HORAS = 24;

/**
 * Reparte lo pendiente. Devuelve cuántos avisos se marcaron. Nunca lanza:
 * quien la llama es una acción de usuario y un fallo del push no puede
 * convertirse en un fallo de guardar una reseña.
 */
export async function repartirPush() {
  if (!pushConfigurado()) return 0;
  try {
    configurar();
    const supabase = supabaseServicio();
    const desde = new Date(Date.now() - VENTANA_HORAS * 3600 * 1000).toISOString();

    const { data: avisos, error } = await supabase
      .from("notifications")
      .select(
        "id, kind, profile_id, post_id, restaurant_id, review_id, badge_slug, created_at, restaurants (name, slug), reviews (rating, body, owner_reply, author_id)",
      )
      .is("pushed_at", null)
      .gte("created_at", desde)
      .order("created_at")
      .limit(LOTE);
    if (error) throw error;
    if (!avisos?.length) return 0;

    // Un aviso viejo sin push no se manda ya —llegaría tarde y con la
    // bandeja ya vista—, pero se marca para no volver a recogerlo.
    const perfiles = [...new Set(avisos.map((a) => a.profile_id))];
    const [{ data: prefs }, { data: subs }, { data: autores }] = await Promise.all([
      supabase.from("profiles").select("id, push_prefs").in("id", perfiles),
      supabase.from("push_subscriptions").select("id, profile_id, endpoint, p256dh, auth").in("profile_id", perfiles),
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", [...new Set(avisos.map((a) => a.reviews?.author_id).filter(Boolean))]),
    ]);

    const prefsDe = new Map((prefs ?? []).map((p) => [p.id, p.push_prefs]));
    const subsDe = new Map();
    for (const s of subs ?? []) {
      if (!subsDe.has(s.profile_id)) subsDe.set(s.profile_id, []);
      subsDe.get(s.profile_id).push(s);
    }
    const nombreDe = new Map((autores ?? []).map((p) => [p.id, p.full_name]));

    const muertas = new Set();
    for (const a of avisos) {
      const suscripciones = subsDe.get(a.profile_id) ?? [];
      if (suscripciones.length && pushPermitido(prefsDe.get(a.profile_id), a.kind)) {
        const texto = textoDePush({
          ...a,
          restaurant_name: a.restaurants?.name,
          restaurant_slug: a.restaurants?.slug,
          review_rating: a.reviews?.rating,
          review_author: (nombreDe.get(a.reviews?.author_id) || "").trim() || "Comensal",
          review_excerpt: String(
            (a.kind === "respuesta" ? a.reviews?.owner_reply : a.reviews?.body) ?? "",
          ).slice(0, 120),
        });
        if (texto) {
          const payload = JSON.stringify({
            titulo: texto.titulo,
            cuerpo: texto.cuerpo,
            url: urlDelSitio(texto.url),
            tag: texto.tag,
          });
          await Promise.all(
            suscripciones.map(async (s) => {
              try {
                await webpush.sendNotification(
                  { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                  payload,
                  { TTL: 6 * 3600, urgency: "normal" },
                );
              } catch (fallo) {
                // 404 y 410: el navegador se dio de baja sin avisar. Se borra
                // la suscripción; lo demás se registra y se sigue.
                if (fallo?.statusCode === 404 || fallo?.statusCode === 410) muertas.add(s.id);
                else console.error("push:", fallo?.statusCode ?? "", fallo?.message);
              }
            }),
          );
        }
      }
    }

    if (muertas.size) {
      await supabase.from("push_subscriptions").delete().in("id", [...muertas]);
    }
    const ahora = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ pushed_at: ahora })
      .in("id", avisos.map((a) => a.id));
    if (subs?.length) {
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: ahora })
        .in("id", subs.map((s) => s.id).filter((id) => !muertas.has(id)));
    }
    return avisos.length;
  } catch (error) {
    console.error("repartir push", error?.message);
    return 0;
  }
}

// Para llamarla de aventón desde una acción: no se espera y no estorba.
export function repartirPushDeAventon() {
  if (!pushConfigurado()) return;
  repartirPush().catch(() => {});
}
