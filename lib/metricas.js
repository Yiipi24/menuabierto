// Capa de datos del tablero del panel.
//
// Los números salen de `public.restaurant_events` a través de la función
// `restaurant_metrics`, que agrupa el periodo en la zona horaria del local y
// devuelve un jsonb. Este archivo traduce ese jsonb a la forma que la pantalla
// espera, y es el único lugar donde se decide qué significa cada cifra: los
// componentes solo pintan.
//
// Los eventos que se registran viven en lib/eventos.js, que es la misma lista
// que el enum `restaurant_event` de la base.
export { EVENTOS } from "./eventos";

// Los periodos que ofrece el filtro. El slug es el que entiende la función de
// la base; `comparativa` es el texto que acompaña a la variación, porque "18%
// vs semana anterior" solo se entiende si el periodo es la semana.
export const PERIODOS = [
  {
    slug: "hoy",
    frase: "hoy",
    etiqueta: "Hoy",
    comparativa: "vs ayer",
    titulo: "Rendimiento de hoy",
  },
  {
    slug: "7d",
    frase: "esta semana",
    etiqueta: "Últimos 7 días",
    comparativa: "vs semana anterior",
    titulo: "Rendimiento de esta semana",
  },
  {
    slug: "30d",
    frase: "este periodo",
    etiqueta: "Últimos 30 días",
    comparativa: "vs mes anterior",
    titulo: "Rendimiento de los últimos 30 días",
  },
  {
    slug: "mes",
    frase: "este mes",
    etiqueta: "Este mes",
    comparativa: "vs mes anterior",
    titulo: "Rendimiento de este mes",
  },
  {
    slug: "mes-anterior",
    frase: "el mes pasado",
    etiqueta: "Mes anterior",
    comparativa: "vs el mes previo",
    titulo: "Rendimiento del mes anterior",
  },
  {
    slug: "90d",
    frase: "este periodo",
    etiqueta: "Últimos 90 días",
    comparativa: "vs periodo anterior",
    titulo: "Rendimiento de los últimos 90 días",
  },
];

export const PERIODO_POR_DEFECTO = "7d";

export function periodoPorSlug(slug) {
  return PERIODOS.find((p) => p.slug === slug) ?? PERIODOS[1];
}

// Cada KPI dice de qué evento sale: así se lee de un vistazo qué hay que
// registrar para que una tarjeta deje de estar en cero.
export const KPIS = [
  { id: "vistas", evento: "restaurant_view", etiqueta: "Visualizaciones", icono: "ojo" },
  { id: "qr", evento: "qr_scan", etiqueta: "Escaneos QR", icono: "qr" },
  { id: "llamadas", evento: "phone_click", etiqueta: "Clics para llamar", icono: "telefono" },
  { id: "rutas", evento: "directions_click", etiqueta: "Cómo llegar", icono: "pin" },
  { id: "guardados", evento: "restaurant_save", etiqueta: "Guardados", icono: "marcador" },
  { id: "calificacion", evento: null, etiqueta: "Calificación", icono: "estrella" },
];

// Las cuatro fuentes del enum `traffic_source`, con el nombre que ve el dueño.
export const FUENTES = [
  { id: "busqueda", etiqueta: "Búsqueda en Menú Abierto", color: "var(--accent)" },
  { id: "qr", etiqueta: "QR", color: "#f59e0b" },
  { id: "redes", etiqueta: "Redes sociales", color: "#a78bfa" },
  { id: "directo", etiqueta: "Link directo", color: "#5eead4" },
];

const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const DIAS_LARGOS = {
  Lun: "lunes",
  Mar: "martes",
  Mié: "miércoles",
  Jue: "jueves",
  Vie: "viernes",
  Sáb: "sábados",
  Dom: "domingos",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaHora(hora) {
  const h = Number(hora) || 0;
  if (h === 0) return "12 am";
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

// `inicio` viene como "2026-09-04T00:00:00" en la hora del local: se parte a
// mano en vez de con Date para no arrastrarlo a la zona del navegador, que es
// justo lo que la función de la base ya resolvió.
function etiquetaDia(inicio) {
  const [fecha] = String(inicio ?? "").split("T");
  const [, mes, dia] = fecha.split("-");
  if (!mes || !dia) return "";
  return `${Number(dia)} ${MESES[Number(mes) - 1] ?? ""}`.trim();
}

function serieConEtiquetas(serie, paso) {
  const puntos = Array.isArray(serie) ? serie : [];

  return puntos.map((p, i) => {
    let etiqueta;
    if (paso === "hour") etiqueta = etiquetaHora(p.hora);
    else if (paso === "week") etiqueta = `Sem ${i + 1}`;
    // Una semana entra completa: los días se nombran. Treinta no, y ahí la
    // fecha dice más que "Mar" repetido cuatro veces.
    else if (puntos.length <= 7) etiqueta = DIAS_CORTOS[(Number(p.dia) || 1) - 1];
    else etiqueta = etiquetaDia(p.inicio);

    return { etiqueta, valor: Number(p.valor) || 0 };
  });
}

function variacion(actual, previo) {
  if (!previo) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

function reparteEnPorcentajes(items, total) {
  if (!total) return items.map((i) => ({ ...i, porcentaje: 0 }));
  return items.map((i) => ({ ...i, porcentaje: Math.round((i.valor / total) * 100) }));
}

/**
 * Traduce lo que devuelve `restaurant_metrics` a lo que pinta el tablero.
 *
 * @param {object|null} datos jsonb de la función, o null si no se pudo leer.
 * @param {{id: string, rating_avg?: number|null, rating_count?: number}} restaurante
 * @param {string} periodoSlug
 */
export function metricasDesdeRpc(datos, restaurante, periodoSlug) {
  const periodo = periodoPorSlug(periodoSlug);
  const totales = datos?.totales ?? {};
  const previos = datos?.previos ?? {};

  const suma = (obj) => Object.values(obj).reduce((a, b) => a + Number(b || 0), 0);
  // Sin un solo evento ni en este periodo ni en el anterior no hay nada que
  // contar: la pantalla enseña el estado vacío en vez de seis ceros.
  const hayDatos = suma(totales) > 0 || suma(previos) > 0;

  const resenas = restaurante?.rating_count ?? 0;
  const calificacion = resenas > 0 ? Number(restaurante.rating_avg) : null;

  const kpis = KPIS.map((k) => {
    if (k.id === "calificacion") {
      return {
        ...k,
        valor: calificacion,
        formato: "calificacion",
        variacion: null,
        nota:
          resenas > 0
            ? `Basado en ${resenas} ${resenas === 1 ? "reseña" : "reseñas"}`
            : "Todavía sin reseñas",
      };
    }

    const actual = Number(totales[k.evento] ?? 0);
    const previo = Number(previos[k.evento] ?? 0);
    const cambio = variacion(actual, previo);

    return {
      ...k,
      valor: actual,
      formato: "entero",
      variacion: cambio,
      nota: cambio == null ? (previo === 0 && actual > 0 ? "Primer periodo con datos" : null) : null,
    };
  });

  const puntos = serieConEtiquetas(datos?.serie, datos?.paso ?? "day");
  const vistas = Number(totales.restaurant_view ?? 0);

  const lugaresCrudos = (datos?.lugares ?? []).map((l) => ({
    nombre: l.nombre,
    valor: Number(l.valor) || 0,
  }));
  const lugares = reparteEnPorcentajes(lugaresCrudos, vistas);

  const fuentesCrudas = FUENTES.map((f) => ({
    ...f,
    valor: Number(datos?.fuentes?.[f.id] ?? 0),
  })).filter((f) => f.valor > 0);
  const fuentes = reparteEnPorcentajes(fuentesCrudas, vistas);

  return {
    hayDatos,
    periodo,
    totales,
    kpis,
    serie: { puntos, total: vistas },
    lugares,
    fuentes,
  };
}

/**
 * Ideas para el dueño, derivadas de las métricas y de la ficha.
 *
 * Devuelve `RestaurantInsight[]`: { id, type, title, description, severity,
 * action }. La pantalla solo las pinta; qué se dice y cuándo se decide aquí.
 *
 * @returns {Array<{id: string, type: string, title: string, description: string, severity: "exito"|"aviso"|"info", action: {label: string, href: string}|null}>}
 */
export function insightsDeMetricas(metricas, restaurante) {
  if (!metricas.hayDatos) return [];

  const ideas = [];
  const vistas = metricas.kpis.find((k) => k.id === "vistas");
  const qr = metricas.kpis.find((k) => k.id === "qr");
  const puntos = metricas.serie.puntos;
  const pico = puntos.reduce(
    (mejor, p) => (p.valor > (mejor?.valor ?? -1) ? p : mejor),
    null,
  );

  if (vistas?.variacion != null && vistas.variacion > 0) {
    ideas.push({
      id: "tendencia",
      type: "tendencia",
      title: `Tus visitas subieron ${vistas.variacion}% ${metricas.periodo.frase}`,
      description: "¡Excelente trabajo! Sigue así.",
      severity: "exito",
      action: null,
    });
  } else if (vistas?.variacion != null && vistas.variacion < 0) {
    ideas.push({
      id: "tendencia",
      type: "tendencia",
      title: `Tus visitas bajaron ${Math.abs(vistas.variacion)}% ${metricas.periodo.frase}`,
      description: "Comparte tu menú en redes para recuperar el ritmo.",
      severity: "aviso",
      action: null,
    });
  }

  // Solo se habla del día pico si de verdad destaca: con dos visitas en toda
  // la semana, el "mejor día" es ruido.
  if (pico?.valor >= 3 && DIAS_LARGOS[pico.etiqueta]) {
    ideas.push({
      id: "hora-pico",
      type: "horario",
      title: `Los ${DIAS_LARGOS[pico.etiqueta]} son tu día fuerte`,
      description: "Aprovecha para promocionarte ese día.",
      severity: "aviso",
      action: null,
    });
  } else if (pico?.valor >= 3) {
    ideas.push({
      id: "hora-pico",
      type: "horario",
      title: `Tu mejor momento fue ${pico.etiqueta}`,
      description: "Repite lo que hiciste entonces: promociones y publicaciones.",
      severity: "aviso",
      action: null,
    });
  }

  if ((restaurante?.fotos ?? 0) < 4) {
    ideas.push({
      id: "fotos",
      type: "contenido",
      title: "Agrega más fotos para aumentar conversiones",
      description: "Las fichas con fotos de la fachada y de los platillos se abren más.",
      severity: "info",
      action: { label: "Subir fotos", href: `/panel/${restaurante.id}` },
    });
  } else if ((qr?.valor ?? 0) === 0) {
    ideas.push({
      id: "qr",
      type: "contenido",
      title: "Todavía nadie ha escaneado tu QR",
      description: "Imprímelo y ponlo en la mesa, en la entrada y en la cuenta.",
      severity: "info",
      action: { label: "Ver el QR", href: `/r/${restaurante.slug}` },
    });
  } else {
    ideas.push({
      id: "qr",
      type: "contenido",
      title: "Tu QR está trayendo gente a la mesa",
      description: `${qr.valor} ${qr.valor === 1 ? "escaneo" : "escaneos"} ${metricas.periodo.frase}. Ponlo también en la entrada.`,
      severity: "info",
      action: { label: "Ver el QR", href: `/r/${restaurante.slug}` },
    });
  }

  return ideas.slice(0, 3);
}
