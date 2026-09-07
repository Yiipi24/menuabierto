// Lo que historias y publicaciones comparten, en un solo sitio: los límites que
// el navegador y el servidor tienen que decir igual, y las dos o tres cuentas
// que hacen tanto la ficha como el feed como el panel.

export const BUCKET_SOCIAL = "social";

// Por debajo del `serverActions.bodySizeLimit` de next.config.js, como el resto
// de las subidas: pasado ese tope Next corta la petición antes de que nuestra
// validación exista.
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const TIPOS_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
export const TIPOS_MEDIA = [...TIPOS_IMAGEN, ...TIPOS_VIDEO];

export const MAX_TEXTO_POST = 600;
export const MAX_TEXTO_COMENTARIO = 500;

// Cuántas publicaciones trae cada página de la ficha y del feed. Cinco es lo
// que cabe en una pantalla larga sin que la primera carga tenga que bajar diez
// videos de golpe.
export const POR_PAGINA = 5;
export const POR_PAGINA_FEED = 10;

export const TIPOS = {
  historia: {
    slug: "historia",
    nombre: "Historia",
    pista: "Se ve 24 horas y desaparece sola. Para lo de hoy.",
  },
  publicacion: {
    slug: "publicacion",
    nombre: "Publicación",
    pista: "Se queda en tu ficha hasta que la borres.",
  },
};

export function esVideo(mime) {
  return typeof mime === "string" && mime.startsWith("video/");
}

export function mediaDeMime(mime) {
  return esVideo(mime) ? "video" : "imagen";
}

// La URL pública del archivo. Va aquí y no repetida en cada página porque son
// cuatro las que la arman: la ficha, el visor, el feed y el panel.
export function urlDeMedia(supabase, path) {
  if (!path) return null;
  return supabase.storage.from(BUCKET_SOCIAL).getPublicUrl(path).data.publicUrl;
}

/**
 * "Hace 2 h", "Hace 1 día". El feed y la ficha ponen la edad de cada pieza, no
 * su fecha: en algo que dura un día, "6 de septiembre" no dice si fue hace un
 * rato o hace veintitrés horas.
 *
 * Se calcula en el navegador —el componente es cliente— para que la hora del
 * servidor no adelante ni atrase respecto a quien lee.
 */
export function hace(iso, ahora = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";

  const segundos = Math.max(0, Math.floor((ahora - t) / 1000));
  if (segundos < 60) return "Hace un momento";

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} ${dias === 1 ? "día" : "días"}`;

  const semanas = Math.floor(dias / 7);
  if (semanas < 5) return `Hace ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;

  const meses = Math.floor(dias / 30);
  if (meses < 12) return `Hace ${meses} ${meses === 1 ? "mes" : "meses"}`;

  const anios = Math.floor(dias / 365);
  return `Hace ${anios} ${anios === 1 ? "año" : "años"}`;
}

// Lo que le queda a una historia antes de irse. El visor lo enseña para que
// quien la ve sepa que es de hoy y no de la semana pasada.
export function leQueda(expiresAt, ahora = Date.now()) {
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return "";
  const minutos = Math.floor((t - ahora) / 60000);
  if (minutos <= 0) return "Ya caducó";
  if (minutos < 60) return `Queda ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `Quedan ${horas} h`;
}

// Los números de la ficha se dicen cortos: "1,248 seguidores" cabe, pero
// "12483" al lado de un botón no se lee de un vistazo.
export function conteo(n) {
  const valor = Number(n) || 0;
  if (valor < 1000) return String(valor);
  if (valor < 10000) return `${(valor / 1000).toFixed(1).replace(/\.0$/, "")} mil`;
  return `${Math.round(valor / 1000)} mil`;
}

export function plural(n, singular, pluralForma) {
  return Number(n) === 1 ? singular : pluralForma;
}

// El aviso a mostrar, o null si el archivo pasa. Lo usan el navegador (antes de
// gastar la subida) y la acción de servidor (que es la que manda).
export function revisarMedia(archivo) {
  if (!archivo || !archivo.size) return "Elige una foto o un video.";
  if (!TIPOS_MEDIA.includes(archivo.type)) {
    return "Solo aceptamos fotos (JPG, PNG, WebP) y videos (MP4, WebM, MOV).";
  }
  if (archivo.size > MAX_MEDIA_BYTES) {
    return "El archivo pesa más de 10 MB. Comprímelo o sube uno más ligero.";
  }
  return null;
}

// La extensión con la que se guarda en el bucket. Del mime y no del nombre del
// archivo: un ".jpeg" escrito a mano no dice qué trae dentro.
export function extensionDeMime(mime) {
  const tabla = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return tabla[mime] ?? "bin";
}

// ---------------------------------------------------------------------------
// Programar
// ---------------------------------------------------------------------------
// La hora de salida vive en `publish_at`. Mientras no llega, la pieza solo
// existe para su dueño: las funciones de lectura la esconden igual que
// esconden la historia caducada.

// Cuánto se puede programar por delante. Tres meses es de sobra para una
// campaña de temporada y poco para que se olvide lo que hay agendado.
export const MAX_DIAS_PROGRAMAR = 90;

// Un minuto de margen: entre que se elige la hora y se manda el formulario
// pasan segundos, y rechazar "las 14:00" a las 14:00:03 es una pelea con el
// reloj y no con el dueño.
export const MARGEN_PROGRAMAR_MS = 60 * 1000;

export function estaProgramada(pieza, ahora = Date.now()) {
  if (!pieza?.publish_at) return false;
  return new Date(pieza.publish_at).getTime() > ahora;
}

/**
 * El aviso a mostrar si la fecha no sirve, o null si pasa. Lo usan el
 * navegador (antes de subir el archivo) y la acción de servidor, que es la que
 * manda: el reloj del navegador se puede mover.
 */
export function revisarProgramacion(valor, ahora = Date.now()) {
  const t = new Date(valor ?? "").getTime();
  if (Number.isNaN(t)) return "Elige el día y la hora en que quieres que salga.";
  if (t < ahora - MARGEN_PROGRAMAR_MS) {
    return "Esa hora ya pasó. Elige una más adelante o publícalo ahora.";
  }
  if (t > ahora + MAX_DIAS_PROGRAMAR * 24 * 60 * 60 * 1000) {
    return `Solo se puede programar con ${MAX_DIAS_PROGRAMAR} días de anticipación.`;
  }
  return null;
}

/**
 * "Hoy a las 14:30", "Mañana a las 9:00", "Mar 14 de octubre, 11:00". Lo que
 * la tarjeta de una pieza programada dice arriba.
 *
 * Se arma en el navegador para que la hora sea la de quien lee, que es la
 * misma que eligió al programarla.
 */
export function cuandoSale(iso, ahora = Date.now()) {
  const fecha = new Date(iso);
  const t = fecha.getTime();
  if (Number.isNaN(t)) return "";

  const hora = fecha.toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  });

  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((dia - hoy) / 86400000);

  if (dias === 0) return `Hoy a las ${hora}`;
  if (dias === 1) return `Mañana a las ${hora}`;

  const cuando = fecha.toLocaleDateString("es-MX", {
    weekday: dias < 7 ? "long" : undefined,
    day: "numeric",
    month: "long",
  });
  return `${cuando[0].toUpperCase()}${cuando.slice(1)}, ${hora}`;
}

/**
 * El valor de un `<input type="datetime-local">`: la hora local sin zona, que
 * es lo único que ese control entiende. `toISOString` daría UTC y adelantaría
 * la hora seis lugares.
 */
export function paraInputLocal(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(
    d.getHours(),
  )}:${dos(d.getMinutes())}`;
}

// La hora que se propone al abrir el programador: la siguiente en punto,
// redondeada hacia arriba. Elegir "dentro de un rato" es lo normal y así no
// hay que teclear nada para que la fecha sea válida.
export function proximaHoraEnPunto(ahora = Date.now()) {
  const d = new Date(ahora);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
