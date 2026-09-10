// La llamada al modelo de visión que lee la carta. Solo del lado del servidor:
// la llave da acceso a la cuenta de la API y no sale de las variables de
// entorno. Todo lo que no es hablar con la API —el esquema, la limpieza de la
// respuesta, los cupos— vive en `lib/extraccion.js` y se prueba sin red.

import Anthropic from "@anthropic-ai/sdk";
import { ESQUEMA_CARTA, INSTRUCCIONES, normalizarExtraccion, tipoDeEntrada } from "./extraccion";

// Opus 5: lee una foto de carta con letra chica y fondo de pizarra donde un
// modelo más chico se inventa precios, y una carta se lee una vez. El esfuerzo
// va en medio: es transcribir, no razonar, y así cuesta la mitad.
export const MODELO = "claude-opus-5";

// Una carta de cuarenta platillos con descripciones son unos tres mil tokens
// de salida; el tope deja sitio para una de doscientos sin cortarse a medias.
const MAX_TOKENS = 16000;

// Una foto grande tarda; el tope va por debajo del de la función de Vercel
// (ver `maxDuration` en la página) para que el error sea nuestro y con texto,
// no un corte de la plataforma.
const TIEMPO_MS = 110_000;

export function visionConfigurada() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Lee una carta. Recibe los bytes y su tipo, devuelve la extracción ya
 * normalizada y cuánto costó en tokens. Lanza si la API falla o rehúsa; quien
 * llama decide qué decirle al dueño.
 */
export async function leerCarta({ bytes, mime }) {
  const tipo = tipoDeEntrada(mime);
  if (!tipo) throw new Error(`Tipo de archivo no admitido: ${mime}`);

  const client = new Anthropic({ timeout: TIEMPO_MS, maxRetries: 1 });
  const data = Buffer.from(bytes).toString("base64");

  const adjunto =
    tipo === "image"
      ? { type: "image", source: { type: "base64", media_type: mime, data } }
      : { type: "document", source: { type: "base64", media_type: mime, data } };

  // En streaming, para que una respuesta larga no choque con el tiempo de la
  // petición; `finalMessage` junta todo. Con `fallbacks: "default"` una
  // negativa del clasificador de seguridad se reintenta sola en otro modelo
  // dentro de la misma llamada, en vez de dejar al dueño sin carta.
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: MAX_TOKENS,
    system: INSTRUCCIONES,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: ESQUEMA_CARTA },
    },
    messages: [
      {
        role: "user",
        content: [
          adjunto,
          {
            type: "text",
            text: "Esta es la carta del restaurante. Devuelve sus secciones, platillos, descripciones y precios.",
          },
        ],
      },
    ],
  });

  const respuesta = await stream.finalMessage();

  if (respuesta.stop_reason === "refusal") {
    throw new Error(`El modelo rehusó leer la imagen (${respuesta.stop_details?.category ?? "sin categoría"}).`);
  }
  if (respuesta.stop_reason === "max_tokens") {
    throw new Error("La respuesta se cortó: la carta es demasiado larga para una sola lectura.");
  }

  const textoJson = respuesta.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  let crudo = null;
  try {
    crudo = JSON.parse(textoJson);
  } catch {
    throw new Error("El modelo no devolvió un JSON válido.");
  }

  return {
    extraccion: normalizarExtraccion(crudo),
    uso: {
      modelo: respuesta.model ?? MODELO,
      entrada: respuesta.usage?.input_tokens ?? null,
      salida: respuesta.usage?.output_tokens ?? null,
    },
  };
}
