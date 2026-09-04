// Capa de datos del tablero del panel.
//
// Todavía no existe una tabla de eventos en la base: lo que se pinta aquí es
// una estimación, no una medición. Vive en este archivo y no dentro de los
// componentes por dos razones. La primera es que el día que existan los
// eventos reales solo hay que cambiar `metricasDeRestaurante` por una
// consulta: la forma que devuelve ya es la que la interfaz espera. La segunda
// es que números sueltos repartidos en seis componentes se vuelven
// imposibles de corregir a la vez.
//
// Los eventos que va a haber que registrar son los de `EVENTOS`. Cada KPI
// declara de cuál sale, así que conectar el primero no obliga a tocar la UI.

export const EVENTOS = [
  "restaurant_view",
  "qr_scan",
  "phone_click",
  "directions_click",
  "restaurant_save",
  "menu_view",
  "social_click",
  "website_click",
];

// Los periodos que ofrece el filtro. `dias` es la ventana que se mide y
// `comparativa` el texto que acompaña a la variación: "18% vs semana
// anterior" solo se entiende si el periodo es la semana.
export const PERIODOS = [
  {
    slug: "hoy",
    frase: "hoy",
    etiqueta: "Hoy",
    dias: 1,
    comparativa: "vs ayer",
    titulo: "Rendimiento de hoy",
  },
  {
    slug: "7d",
    frase: "esta semana",
    etiqueta: "Últimos 7 días",
    dias: 7,
    comparativa: "vs semana anterior",
    titulo: "Rendimiento de esta semana",
  },
  {
    slug: "30d",
    frase: "este periodo",
    etiqueta: "Últimos 30 días",
    dias: 30,
    comparativa: "vs mes anterior",
    titulo: "Rendimiento de los últimos 30 días",
  },
  {
    slug: "mes",
    frase: "este mes",
    etiqueta: "Este mes",
    dias: 30,
    comparativa: "vs mes anterior",
    titulo: "Rendimiento de este mes",
  },
  {
    slug: "mes-anterior",
    frase: "el mes pasado",
    etiqueta: "Mes anterior",
    dias: 30,
    comparativa: "vs el mes previo",
    titulo: "Rendimiento del mes anterior",
  },
  {
    slug: "90d",
    frase: "este periodo",
    etiqueta: "Últimos 90 días",
    dias: 90,
    comparativa: "vs periodo anterior",
    titulo: "Rendimiento de los últimos 90 días",
  },
];

export const PERIODO_POR_DEFECTO = "7d";

export function periodoPorSlug(slug) {
  return PERIODOS.find((p) => p.slug === slug) ?? PERIODOS[1];
}

// Cada KPI dice de qué evento sale para que conectar los datos reales sea
// cambiar el origen y no rehacer la fila de tarjetas.
export const KPIS = [
  { id: "vistas", evento: "restaurant_view", etiqueta: "Visualizaciones", icono: "ojo" },
  { id: "qr", evento: "qr_scan", etiqueta: "Escaneos QR", icono: "qr" },
  { id: "llamadas", evento: "phone_click", etiqueta: "Clics para llamar", icono: "telefono" },
  { id: "rutas", evento: "directions_click", etiqueta: "Cómo llegar", icono: "pin" },
  { id: "guardados", evento: "restaurant_save", etiqueta: "Guardados", icono: "marcador" },
  { id: "calificacion", evento: null, etiqueta: "Calificación", icono: "estrella" },
];

export const FUENTES = [
  { id: "busqueda", etiqueta: "Búsqueda en Menú Abierto", peso: 42, color: "var(--accent)" },
  { id: "qr", etiqueta: "QR", peso: 30, color: "#f59e0b" },
  { id: "redes", etiqueta: "Redes sociales", peso: 18, color: "#a78bfa" },
  { id: "directo", etiqueta: "Link directo", peso: 10, color: "#5eead4" },
];

const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Para las ideas: "los sáb" se lee mal, "los sábados" no.
const DIAS_LARGOS = {
  Lun: "lunes",
  Mar: "martes",
  Mié: "miércoles",
  Jue: "jueves",
  Vie: "viernes",
  Sáb: "sábados",
  Dom: "domingos",
};

// Ciudades del área metropolitana que se usan como vecinas cuando no hay
// datos reales de origen. La primera fila siempre es la ciudad del propio
// restaurante: es la que de verdad conocemos.
const VECINAS = [
  "Monterrey",
  "San Nicolás",
  "Apodaca",
  "Guadalupe",
  "Santa Catarina",
  "San Pedro",
  "Escobedo",
];

// Ritmo semanal de un restaurante: el fin de semana pesa más que el martes.
// Se usa para que la gráfica tenga forma de restaurante y no de ruido.
const RITMO_SEMANAL = [0.72, 0.9, 0.83, 0.99, 1.3, 1.98, 1.4];

// Base del periodo de 7 días. El resto de los periodos escala desde aquí en
// vez de tener su propia tabla de números inventados.
const BASE_7D = {
  vistas: 12480,
  qr: 1294,
  llamadas: 386,
  rutas: 542,
  guardados: 218,
};

// Semilla estable a partir del id del restaurante: el mismo restaurante ve
// siempre los mismos números, y el servidor y el navegador pintan lo mismo
// (si variara, React marcaría diferencia de hidratación).
function semilla(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function azarDe(valor) {
  let a = valor >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function entre(azar, min, max) {
  return min + azar() * (max - min);
}

function reparte(total, pesos) {
  // Reparte un entero entre varios pesos sin que la suma se salga por el
  // redondeo: el último se lleva lo que sobra.
  const suma = pesos.reduce((a, b) => a + b, 0);
  const partes = pesos.map((p) => Math.round((total * p) / suma));
  const dif = total - partes.reduce((a, b) => a + b, 0);
  partes[partes.length - 1] += dif;
  return partes;
}

function etiquetasDeSerie(periodo) {
  if (periodo.slug === "hoy") {
    return ["8 am", "11 am", "2 pm", "5 pm", "8 pm", "11 pm"];
  }
  if (periodo.dias <= 7) return DIAS_CORTOS;
  if (periodo.dias <= 31) return ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  return ["Sem 1", "Sem 3", "Sem 5", "Sem 7", "Sem 9", "Sem 11", "Sem 13"];
}

// Un restaurante sin publicar no recibe visitas, así que tampoco tiene
// estadísticas que enseñar. Es la misma regla que va a valer cuando los
// eventos sean reales, por eso vive aquí y no en la pantalla.
export function tieneMetricas(restaurante) {
  return restaurante?.status === "publicado";
}

/**
 * Métricas de un restaurante para un periodo.
 *
 * @param {{id: string, city?: string, status?: string, rating_avg?: number|null, rating_count?: number}} restaurante
 * @param {string} periodoSlug
 * @returns {{
 *   hayDatos: boolean,
 *   periodo: object,
 *   totales: Record<string, number>,
 *   kpis: Array<{id: string, etiqueta: string, icono: string, evento: string|null, valor: number|null, formato: string, variacion: number|null, nota: string|null}>,
 *   serie: {puntos: Array<{etiqueta: string, valor: number}>, total: number},
 *   lugares: Array<{nombre: string, porcentaje: number, valor: number}>,
 *   fuentes: Array<{id: string, etiqueta: string, color: string, porcentaje: number, valor: number}>,
 * }}
 */
export function metricasDeRestaurante(restaurante, periodoSlug) {
  const periodo = periodoPorSlug(periodoSlug);
  const hayDatos = tieneMetricas(restaurante);

  const azar = azarDe(semilla(`${restaurante?.id ?? "sin-id"}:${periodo.slug}`));
  // Cada restaurante tiene su propio tamaño; el periodo escala sobre eso.
  const tamano = hayDatos ? entre(azar, 0.72, 1.28) : 0;
  const escala = (periodo.dias / 7) * tamano;

  const totales = {};
  for (const [clave, base] of Object.entries(BASE_7D)) {
    totales[clave] = Math.round(base * escala * entre(azar, 0.92, 1.08));
  }

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
    return {
      ...k,
      valor: totales[k.id] ?? 0,
      formato: "entero",
      // La variación es contra el periodo anterior del mismo largo.
      variacion: hayDatos ? Math.round(entre(azar, 2, 26)) : null,
      nota: null,
    };
  });

  const etiquetas = etiquetasDeSerie(periodo);
  const pesos = etiquetas.map((_, i) =>
    etiquetas.length === 7
      ? RITMO_SEMANAL[i]
      : entre(azar, 0.75, 1.35) * (1 + i * 0.06),
  );
  const valores = reparte(totales.vistas ?? 0, pesos);
  const serie = {
    puntos: etiquetas.map((etiqueta, i) => ({ etiqueta, valor: valores[i] })),
    total: totales.vistas ?? 0,
  };

  const propia = restaurante?.city?.trim() || "Tu ciudad";
  const nombres = [propia, ...VECINAS.filter((v) => v !== propia)].slice(0, 5);
  const pesosLugar = [42, 26, 14, 10, 8];
  const valoresLugar = reparte(totales.vistas ?? 0, pesosLugar);
  const lugares = nombres.map((nombre, i) => ({
    nombre,
    porcentaje: pesosLugar[i],
    valor: valoresLugar[i],
  }));

  const valoresFuente = reparte(
    totales.vistas ?? 0,
    FUENTES.map((f) => f.peso),
  );
  const fuentes = FUENTES.map((f, i) => ({
    id: f.id,
    etiqueta: f.etiqueta,
    color: f.color,
    porcentaje: f.peso,
    valor: valoresFuente[i],
  }));

  return { hayDatos, periodo, totales, kpis, serie, lugares, fuentes };
}

/**
 * Ideas para el dueño, derivadas de las métricas y de la ficha.
 *
 * Devuelve `RestaurantInsight[]`: { id, type, title, description, severity,
 * action }. La pantalla solo las pinta; qué se dice y cuándo se decide aquí,
 * para que mañana salgan de datos reales sin tocar el componente.
 *
 * @returns {Array<{id: string, type: string, title: string, description: string, severity: "exito"|"aviso"|"info", action: {label: string, href: string}|null}>}
 */
export function insightsDeMetricas(metricas, restaurante) {
  if (!metricas.hayDatos) return [];

  const ideas = [];
  const vistas = metricas.kpis.find((k) => k.id === "vistas");
  const qr = metricas.kpis.find((k) => k.id === "qr");
  const pico = metricas.serie.puntos.reduce(
    (mejor, p) => (p.valor > mejor.valor ? p : mejor),
    metricas.serie.puntos[0] ?? { etiqueta: "", valor: 0 },
  );

  if (vistas?.variacion != null && vistas.variacion >= 0) {
    ideas.push({
      id: "tendencia",
      type: "tendencia",
      title: `Tus visitas subieron ${vistas.variacion}% ${metricas.periodo.frase}`,
      description: "¡Excelente trabajo! Sigue así.",
      severity: "exito",
      action: null,
    });
  } else if (vistas?.variacion != null) {
    ideas.push({
      id: "tendencia",
      type: "tendencia",
      title: `Tus visitas bajaron ${Math.abs(vistas.variacion)}% ${metricas.periodo.frase}`,
      description: "Comparte tu menú en redes para recuperar el ritmo.",
      severity: "aviso",
      action: null,
    });
  }

  if (DIAS_LARGOS[pico?.etiqueta]) {
    ideas.push({
      id: "hora-pico",
      type: "horario",
      title: `Los ${DIAS_LARGOS[pico.etiqueta]} de 7 pm a 9 pm son tu hora pico`,
      description: "Aprovecha para promocionarte en ese horario.",
      severity: "aviso",
      action: null,
    });
  } else if (pico?.etiqueta) {
    // En periodos largos el punto alto es una semana, no un día: decir "los
    // Sem 3" no significa nada.
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
      description: "Los restaurantes con más fotos reciben 34% más clics.",
      severity: "info",
      action: { label: "Subir fotos", href: `/panel/${restaurante.id}` },
    });
  } else if (qr) {
    ideas.push({
      id: "qr",
      type: "contenido",
      title: "Tu QR está trayendo gente a la mesa",
      description: "Imprímelo también en la entrada y en la cuenta.",
      severity: "info",
      action: { label: "Ver el QR", href: `/panel/${restaurante.id}/menus` },
    });
  }

  return ideas.slice(0, 3);
}
