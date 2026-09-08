// A qué hora se sirve cada carta.
//
// Un restaurante no tiene "el menú": tiene el de desayuno hasta mediodía, el
// de la comida y el de la cena a partir de las siete. Hasta ahora las tres se
// veían iguales en la ficha y el comensal tenía que abrirlas para descubrir
// que la de desayuno no aplica a las nueve de la noche.
//
// La franja es una lista cerrada —los slugs tienen que coincidir con el
// `check` de `menus.service_time`— y cada una trae su horario de fábrica. El
// dueño puede pisarlo con el suyo: `serves_from` y `serves_to` en la fila del
// menú ganan siempre sobre el de la franja.

export const FRANJAS = [
  {
    slug: "siempre",
    nombre: "Todo el día",
    corto: "Todo el día",
    pista: "Se sirve a cualquier hora que estés abierto.",
    desde: null,
    hasta: null,
  },
  {
    slug: "desayuno",
    nombre: "Desayuno",
    corto: "Desayuno",
    pista: "Temprano, hasta media mañana.",
    desde: "07:00",
    hasta: "12:00",
  },
  {
    slug: "brunch",
    nombre: "Brunch",
    corto: "Brunch",
    pista: "Media mañana y sobre todo el fin de semana.",
    desde: "10:00",
    hasta: "14:00",
  },
  {
    slug: "comida",
    nombre: "Comida",
    corto: "Comida",
    pista: "La corrida del mediodía.",
    desde: "13:00",
    hasta: "18:00",
  },
  {
    slug: "merienda",
    nombre: "Merienda y café",
    corto: "Merienda",
    pista: "La tarde: café, pan, postres.",
    desde: "16:00",
    hasta: "20:00",
  },
  {
    slug: "happy_hour",
    nombre: "Happy hour",
    corto: "Happy hour",
    pista: "Las horas de la promoción en bebidas.",
    desde: "17:00",
    hasta: "20:00",
  },
  {
    slug: "cena",
    nombre: "Cena",
    corto: "Cena",
    pista: "De la tarde-noche en adelante.",
    desde: "19:00",
    hasta: "23:30",
  },
  {
    slug: "noche",
    nombre: "Noche",
    corto: "Noche",
    // La única franja que cruza la medianoche, y por eso todo lo de abajo
    // tiene que saber comparar horarios que dan la vuelta al reloj.
    pista: "Después de cenar y de madrugada.",
    desde: "22:00",
    hasta: "03:00",
  },
  {
    slug: "fin_de_semana",
    nombre: "Fin de semana",
    corto: "Fin de semana",
    pista: "Solo sábado y domingo, a cualquier hora.",
    desde: null,
    hasta: null,
    // Los días viven aquí y no en columnas nuevas: es la única franja que se
    // define por el día y no por la hora.
    dias: [6, 0],
  },
];

export const FRANJA_POR_DEFECTO = "siempre";

const POR_SLUG = new Map(FRANJAS.map((f) => [f.slug, f]));

// Una franja que ya no exista no debe dejar la carta sin horario: cae en
// "todo el día", que es lo que era antes de que esto existiera.
export function franjaValida(slug) {
  return POR_SLUG.has(slug) ? slug : FRANJA_POR_DEFECTO;
}

export function franjaDe(slug) {
  return POR_SLUG.get(franjaValida(slug)) ?? FRANJAS[0];
}

// "18:30:00" y "18:30" son la misma hora; la base devuelve la primera y los
// `<input type="time">` mandan la segunda.
export function horaCorta(valor) {
  const v = String(valor ?? "").trim();
  return /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : "";
}

export function horaValida(valor) {
  const v = horaCorta(valor);
  if (!v) return null;
  const [h, m] = v.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? v : null;
}

/**
 * El horario efectivo de una carta: el que escribió el dueño o, si no lo
 * escribió, el de su franja. Devuelve `{ desde, hasta }` en "HH:MM", o nulos
 * cuando la carta se sirve a cualquier hora.
 */
export function horarioDeMenu(menu) {
  const franja = franjaDe(menu?.service_time ?? menu?.serviceTime);
  const desde = horaValida(menu?.serves_from ?? menu?.servesFrom) ?? franja.desde;
  const hasta = horaValida(menu?.serves_to ?? menu?.servesTo) ?? franja.hasta;
  // Una punta sola no es un horario: sin la otra no se puede decir si la carta
  // está sirviéndose ahora, y media franja escrita a medias confunde más que
  // no poner ninguna.
  return desde && hasta ? { desde, hasta } : { desde: null, hasta: null };
}

function minutos(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

// "13:00" → "1:00 pm". El dueño captura en 24 horas porque es lo que da el
// input del navegador; el comensal lee en 12, que es como se dice en México.
export function horaLegible(hhmm) {
  const v = horaCorta(hhmm);
  if (!v) return "";
  const [h, m] = v.split(":").map(Number);
  const sufijo = h < 12 ? "am" : "pm";
  const doce = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${doce} ${sufijo}` : `${doce}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/**
 * La línea que la ficha pone bajo el nombre de la carta: "Desayuno · 7 am a
 * 12 pm". Vacía cuando la carta se sirve todo el día, que es lo normal y no
 * merece una etiqueta.
 */
export function textoDeHorario(menu) {
  const franja = franjaDe(menu?.service_time ?? menu?.serviceTime);
  const { desde, hasta } = horarioDeMenu(menu);
  if (franja.slug === "siempre" && !desde) return "";
  const rango = desde ? `${horaLegible(desde)} a ${horaLegible(hasta)}` : "";
  if (franja.slug === "siempre") return rango;
  return rango ? `${franja.corto} · ${rango}` : franja.corto;
}

/**
 * ¿Se está sirviendo ahora mismo?
 *
 * La hora es la del local y no la de quien mira: alguien que abre la carta
 * desde Madrid tiene que ver que el desayuno de Monterrey ya cerró, no que el
 * suyo empezó. `zona` es `restaurants.timezone`.
 *
 * Devuelve `null` cuando la carta no tiene horario —se sirve siempre—, porque
 * "sí" y "no aplica" son cosas distintas para quien lo pinta.
 */
export function seSirveAhora(menu, zona, ahora = new Date()) {
  const franja = franjaDe(menu?.service_time ?? menu?.serviceTime);
  const { desde, hasta } = horarioDeMenu(menu);
  if (franja.slug === "siempre" && !desde) return null;

  let hora;
  let dia;
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: zona || "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(ahora);
    const valor = (tipo) => partes.find((p) => p.type === tipo)?.value ?? "";
    // Medianoche sale como "24" en algunos entornos.
    const h = Number(valor("hour")) % 24;
    hora = h * 60 + Number(valor("minute"));
    dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(valor("weekday"));
  } catch {
    return null;
  }

  if (franja.dias && !franja.dias.includes(dia)) return false;
  if (!desde) return true;

  const a = minutos(desde);
  const b = minutos(hasta);
  // La carta de la noche va de las 22:00 a las 03:00: su rango da la vuelta al
  // reloj y las dos mitades cuentan.
  return a <= b ? hora >= a && hora < b : hora >= a || hora < b;
}

/**
 * Ordena las cartas como las quiere ver el comensal: primero la principal,
 * luego las que se están sirviendo a esta hora y al final el resto, cada grupo
 * respetando el orden que les dio el dueño.
 */
export function ordenarParaLaFicha(menus, zona, ahora = new Date()) {
  const peso = (m) => {
    if (m.isPrimary ?? m.is_primary) return 0;
    return seSirveAhora(m, zona, ahora) === false ? 2 : 1;
  };
  return [...(menus ?? [])].sort((a, b) => peso(a) - peso(b));
}
