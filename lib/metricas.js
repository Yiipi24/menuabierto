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
  { id: "menus", evento: "menu_view", etiqueta: "Menús abiertos", icono: "carta" },
  { id: "llamadas", evento: "phone_click", etiqueta: "Clics para llamar", icono: "telefono" },
  // Dos cifras de WhatsApp y no una: la distancia entre tocar el botón y
  // mandar el pedido armado es lo que dice si la carta digital está vendiendo
  // o solo consultándose.
  { id: "whatsapp", evento: "whatsapp_click", etiqueta: "Clics a WhatsApp", icono: "whatsapp" },
  {
    id: "pedidos",
    evento: "whatsapp_order",
    etiqueta: "Pedidos por WhatsApp",
    icono: "whatsapp",
  },
  { id: "rutas", evento: "directions_click", etiqueta: "Cómo llegar", icono: "pin" },
  { id: "guardados", evento: "restaurant_save", etiqueta: "Guardados", icono: "marcador" },
  { id: "calificacion", evento: null, etiqueta: "Calificación", icono: "estrella" },
];

// Seguir y guardar en favoritos no dejan evento: son filas en sus tablas, y lo
// que importa de ellas es el total acumulado y no cuántas hubo esta semana.
// Por eso no son KPIs —una tarjeta con flecha diría "tus seguidores bajaron
// 20%" cuando en realidad siguen ahí— sino su propio bloque, con el total en
// grande y cuántos entraron en el periodo debajo.
export const COMUNIDAD = [
  {
    id: "seguidores",
    clave: "seguidores",
    etiqueta: "Seguidores",
    icono: "gente",
    pista: "Reciben aviso de tus historias.",
  },
  {
    id: "favoritos",
    clave: "favoritos",
    etiqueta: "Favoritos",
    icono: "corazon",
    pista: "Te guardaron en su lista.",
  },
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
  // contar: la pantalla enseña el estado vacío en vez de seis ceros. Un
  // seguidor o un favorito también son datos: un restaurante recién publicado
  // que ya tiene a alguien siguiéndolo no debería ver "todavía no hay nada".
  const seguidoresTotal = Number(datos?.seguidores?.total ?? 0);
  const favoritosTotal = Number(datos?.favoritos?.total ?? 0);
  const hayDatos =
    suma(totales) > 0 || suma(previos) > 0 || seguidoresTotal > 0 || favoritosTotal > 0;

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
    // El punto puede faltar: hay visitas que llegan sin coordenadas y esas
    // cuentan en el ranking aunque no se puedan pintar en el mapa.
    lat: l.lat == null ? null : Number(l.lat),
    lng: l.lng == null ? null : Number(l.lng),
  }));
  const lugares = reparteEnPorcentajes(lugaresCrudos, vistas);

  // El desglose por carta. La base ya manda las cartas ordenadas por lo más
  // visto y con las que van en cero incluidas: el cero es el dato útil, porque
  // es la carta que nadie abre.
  //
  // `escaneos` sigue llegando de la base y ya no se usa: con un solo QR por
  // restaurante, el escaneo ocurre en la ficha y no en ninguna carta, así que
  // siempre vendría en cero.
  const cartas = (datos?.cartas ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    vistas: Number(c.vistas) || 0,
  }));

  // Seguidores y favoritos. El total es la cifra que se enseña en grande; los
  // "nuevos" del periodo llevan su variación contra el periodo anterior, que
  // es lo único que aquí puede subir o bajar.
  const comunidad = COMUNIDAD.map((c) => {
    const bloque = datos?.[c.clave] ?? {};
    const nuevos = Number(bloque.nuevos ?? 0);
    const previos = Number(bloque.previos ?? 0);
    return {
      ...c,
      total: Number(bloque.total ?? 0),
      nuevos,
      variacion: variacion(nuevos, previos),
    };
  });

  // Los cupones, con su embudo completo y la conversión ya calculada: la
  // pantalla pinta y no divide.
  const cupones = (datos?.cupones ?? []).map((c) => {
    const vistas = Number(c.vistas) || 0;
    const canjes = Number(c.canjes) || 0;
    return {
      id: c.id,
      codigo: c.codigo,
      titulo: c.titulo,
      activo: Boolean(c.activo),
      vistas,
      copias: Number(c.copias) || 0,
      canjes,
      conversion: vistas ? Math.round((canjes / vistas) * 100) : null,
    };
  });

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
    // Con una sola carta el desglose no desglosa nada: sus números son los de
    // la ficha y la tarjeta solo repetiría lo de arriba.
    cartas: cartas.length > 1 ? reparteEnPorcentajes(
      cartas.map((c) => ({ ...c, valor: c.vistas })),
      cartas.reduce((a, c) => a + c.vistas, 0),
    ) : [],
    lugares,
    fuentes,
    comunidad,
    cupones,
    // El punto del propio restaurante, para que el mapa se centre en el local
    // y no en el promedio de quienes lo miran.
    ficha: datos?.ficha
      ? { lat: Number(datos.ficha.lat), lng: Number(datos.ficha.lng) }
      : null,
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
      action: { label: "Ver el QR", href: `/panel/${restaurante.id}/qr` },
    });
  } else {
    ideas.push({
      id: "qr",
      type: "contenido",
      title: "Tu QR está trayendo gente a la mesa",
      description: `${qr.valor} ${qr.valor === 1 ? "escaneo" : "escaneos"} ${metricas.periodo.frase}. Ponlo también en la entrada.`,
      severity: "info",
      action: { label: "Ver el QR", href: `/panel/${restaurante.id}/qr` },
    });
  }

  return ideas.slice(0, 3);
}

/**
 * Suma los jsonb de varios restaurantes en uno solo.
 *
 * El tablero deja elegir "Todos" o un puñado de restaurantes, y la función de
 * la base contesta por uno. En vez de escribir otra función en SQL que sepa
 * agregar, se piden en paralelo y se suman aquí: la forma del resultado es la
 * misma que la de un restaurante, así que el resto de la pantalla no se entera
 * de cuántos hay detrás.
 *
 * @param {Array<object|null>} lista jsonb de `restaurant_metrics`, uno por restaurante.
 */
export function combinaMetricas(lista) {
  const partes = (lista ?? []).filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.length === 1) return partes[0];

  const sumaMapas = (clave) => {
    const total = {};
    for (const p of partes) {
      for (const [k, v] of Object.entries(p?.[clave] ?? {})) {
        total[k] = (total[k] ?? 0) + Number(v || 0);
      }
    }
    return total;
  };

  // La serie es la misma rejilla de tiempo para todos —el mismo periodo y el
  // mismo paso—, así que se suman punto a punto. Si alguna viniera más corta,
  // manda la más larga y las que falten cuentan como cero.
  const base = partes.reduce(
    (mejor, p) => ((p?.serie?.length ?? 0) > (mejor?.serie?.length ?? 0) ? p : mejor),
    partes[0],
  );
  const serie = (base?.serie ?? []).map((punto, i) => ({
    ...punto,
    valor: partes.reduce((a, p) => a + Number(p?.serie?.[i]?.valor ?? 0), 0),
  }));

  const sumaComunidad = (clave) => ({
    total: partes.reduce((a, p) => a + Number(p?.[clave]?.total ?? 0), 0),
    nuevos: partes.reduce((a, p) => a + Number(p?.[clave]?.nuevos ?? 0), 0),
    previos: partes.reduce((a, p) => a + Number(p?.[clave]?.previos ?? 0), 0),
  });

  const porLugar = new Map();
  for (const p of partes) {
    for (const l of p?.lugares ?? []) {
      const actual = porLugar.get(l.nombre);
      if (actual) actual.valor += Number(l.valor) || 0;
      else porLugar.set(l.nombre, { ...l, valor: Number(l.valor) || 0 });
    }
  }
  const lugares = [...porLugar.values()].sort((a, b) => b.valor - a.valor).slice(0, 6);

  return {
    paso: base?.paso ?? "day",
    totales: sumaMapas("totales"),
    previos: sumaMapas("previos"),
    fuentes: sumaMapas("fuentes"),
    serie,
    lugares,
    // Las cartas son de un restaurante concreto: juntarlas mezclaría "Comida"
    // de dos locales en una sola barra. Con varios seleccionados no se enseñan,
    // y los cupones tampoco: dos sucursales pueden repartir el mismo código y
    // sumarlos escondería cuál de las dos lo está trabajando.
    cartas: [],
    cupones: [],
    // Seguidores y favoritos sí se suman: son personas, y quien tiene tres
    // sucursales quiere saber a cuántas les gusta su negocio, no cada local.
    seguidores: sumaComunidad("seguidores"),
    favoritos: sumaComunidad("favoritos"),
    // Sin un local único no hay punto que marcar en el mapa; los círculos de
    // "desde dónde te ven" siguen saliendo.
    ficha: null,
  };
}

/**
 * El "sujeto" de las métricas: uno o varios restaurantes vistos como uno.
 *
 * La calificación se pondera por número de reseñas —el promedio de promedios
 * miente cuando uno tiene tres reseñas y el otro doscientas— y las fotos se
 * cuentan por el que peor está, que es al que hay que empujar.
 */
export function sujetoDeSeleccion(seleccionados) {
  const lista = seleccionados ?? [];
  if (lista.length === 1) return lista[0];

  const resenas = lista.reduce((a, r) => a + (r.rating_count ?? 0), 0);
  const suma = lista.reduce(
    (a, r) => a + (r.rating_count ?? 0) * Number(r.rating_avg ?? 0),
    0,
  );
  const masFlojo = lista.reduce(
    (peor, r) => ((r.fotos ?? 0) < (peor?.fotos ?? Infinity) ? r : peor),
    null,
  );

  return {
    id: masFlojo?.id ?? lista[0]?.id,
    name: lista.length ? `tus ${lista.length} restaurantes` : "tus restaurantes",
    varios: true,
    status: lista.some((r) => r.status === "publicado") ? "publicado" : lista[0]?.status,
    fotos: masFlojo?.fotos ?? 0,
    rating_count: resenas,
    rating_avg: resenas > 0 ? suma / resenas : null,
  };
}
