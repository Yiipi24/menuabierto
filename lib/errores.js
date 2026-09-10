// A dónde van los errores de producción.
//
// Vercel guarda los logs, pero nadie los lee hasta que un usuario avisa. Esto
// manda cada error a un lugar donde alguien sí mira —un canal de Slack o de
// Discord, por webhook— además de dejarlo en el log. Sin `ERRORES_WEBHOOK_URL`
// solo queda el log, que es lo que había.
//
// El cuerpo sirve para los dos: Slack lee `text` y Discord lee `content`.

const MAX_TEXTO = 1800;

export function resumenDeError(error, contexto = {}) {
  const mensaje = String(error?.message ?? error ?? "Error sin mensaje").slice(0, 400);
  const pila = String(error?.stack ?? "")
    .split("\n")
    .slice(1, 5)
    .map((l) => l.trim())
    .join("\n");
  const donde = [contexto.ruta, contexto.metodo, contexto.tipo].filter(Boolean).join(" ");
  return { mensaje, pila, donde: donde || null, digest: error?.digest ?? contexto.digest ?? null };
}

export function textoDeAviso(resumen, entorno = process.env.VERCEL_ENV ?? "local") {
  const lineas = [
    `⚠️ menuabierto · ${entorno}${resumen.donde ? ` · ${resumen.donde}` : ""}`,
    resumen.mensaje,
    resumen.digest ? `digest: ${resumen.digest}` : null,
    resumen.pila ? `\`\`\`\n${resumen.pila}\n\`\`\`` : null,
  ];
  return lineas.filter(Boolean).join("\n").slice(0, MAX_TEXTO);
}

export async function reportarError(error, contexto = {}) {
  const resumen = resumenDeError(error, contexto);
  console.error("error:", JSON.stringify({ ...resumen, ...contexto }));

  const url = process.env.ERRORES_WEBHOOK_URL;
  if (!url) return false;
  try {
    const texto = textoDeAviso(resumen);
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: texto, content: texto }),
      signal: AbortSignal.timeout(3000),
    });
    return respuesta.ok;
  } catch (fallo) {
    // Que falle el aviso no puede convertirse en otro error que avisar.
    console.error("error: no se pudo mandar el aviso", fallo?.message);
    return false;
  }
}
