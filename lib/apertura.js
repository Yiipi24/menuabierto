// "Abre viernes 19:00": la siguiente vez que el local abre, dicha en la hora
// de su ciudad.
//
// Se calcula aquí, con los horarios que la ficha ya trajo, y no con otra
// consulta: `restaurant_abierto` en la base responde "¿ahora?", y esto es
// "¿cuándo?". Las dos preguntas salen de las mismas filas.

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function minutos(hhmm) {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function hhmm(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Día de la semana (0 = domingo) y minuto del día en la zona del local. */
export function ahoraLocal(zona, ahora = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: zona || "America/Mexico_City",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(ahora);
    const leer = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
    const dias = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dia = dias.indexOf(leer("weekday").toLowerCase());
    const hora = Number(leer("hour")) % 24;
    const minuto = Number(leer("minute"));
    if (dia === -1 || !Number.isFinite(hora) || !Number.isFinite(minuto)) throw new Error();
    return { dia, minuto: hora * 60 + minuto };
  } catch {
    return { dia: ahora.getDay(), minuto: ahora.getHours() * 60 + ahora.getMinutes() };
  }
}

/**
 * La próxima apertura, o null si no hay horarios.
 *
 * Devuelve `{ dia, hora, texto }` con el texto ya redactado: "Abre hoy 19:00",
 * "Abre mañana 13:00" o "Abre viernes 19:00". Si el local está abierto
 * ahora, devuelve en cambio a qué hora cierra: "Cierra 00:15".
 */
export function proximaApertura(horarios, zona, abierto = false, ahora = new Date()) {
  const tramos = (horarios ?? [])
    .map((h) => ({ dia: Number(h.weekday), abre: minutos(h.opens), cierra: minutos(h.closes) }))
    .filter((t) => t.abre !== null && t.cierra !== null && t.dia >= 0 && t.dia <= 6);
  if (!tramos.length) return null;

  const { dia, minuto } = ahoraLocal(zona, ahora);

  if (abierto) {
    // El tramo vigente: el de hoy que aún no cierra, o el de ayer que cruzó la
    // medianoche.
    const vigente =
      tramos.find((t) => t.dia === dia && t.cierra > t.abre && minuto >= t.abre && minuto <= t.cierra) ??
      tramos.find((t) => t.dia === dia && t.cierra <= t.abre && minuto >= t.abre) ??
      tramos.find((t) => t.dia === (dia + 6) % 7 && t.cierra <= t.abre && minuto <= t.cierra);
    if (!vigente) return null;
    return { dia: vigente.dia, hora: hhmm(vigente.cierra), texto: `Cierra ${hhmm(vigente.cierra)}` };
  }

  // Se recorren los siete días a partir de hoy y se toma el primer tramo que
  // empieza después de este minuto.
  for (let salto = 0; salto < 8; salto += 1) {
    const d = (dia + salto) % 7;
    const candidatos = tramos
      .filter((t) => t.dia === d && (salto > 0 || t.abre > minuto))
      .sort((a, b) => a.abre - b.abre);
    if (candidatos.length) {
      const t = candidatos[0];
      const cuando = salto === 0 ? "hoy" : salto === 1 ? "mañana" : DIAS[d];
      return { dia: d, hora: hhmm(t.abre), texto: `Abre ${cuando} ${hhmm(t.abre)}` };
    }
  }
  return null;
}
