// El asistente de WhatsApp: qué contestarle a cada mensaje.
//
// Es una función pura —recibe la ficha, el chat y el mensaje; devuelve qué
// contestar, cómo queda el chat y, si el cliente confirmó, el pedido que hay
// que guardar— para poder probar la conversación entera sin Meta y sin base.
// Quien carga los datos, guarda y manda está en `app/api/whatsapp/atender.js`.
//
// Contesta con lo que la ficha publica y nada más: el horario de
// `restaurant_hours`, la carta con sus precios, la dirección, las formas de
// pago. No hay un modelo de lenguaje redactando respuestas: una hora de cierre
// inventada manda a alguien a un local cerrado, y un precio inventado es una
// promesa que el restaurante no hizo. Lo que no entiende lo dice, y ofrece las
// opciones.
//
// Y contesta con un mensaje por mensaje. Desde octubre de 2026 Meta cobra las
// respuestas pasadas las primeras mil del mes por número, así que la respuesta
// y sus botones viajan juntos en vez de en dos mensajes.

import { pesos } from "./precios";
import { proximaApertura } from "./apertura";
import { horaLegible } from "./horarios-menu";
import { entregaDe } from "./whatsapp";
import {
  CUANTOS,
  MAX_DIRECCION,
  MAX_DETALLE,
  MAX_NOTA_PEDIDO,
  agregarAlCarrito,
  carritoValido,
  catalogoParaPedir,
  entregaEnTexto,
  interpretarPedido,
  leerMensajeDeLaCarta,
  lineasDelCarrito,
  normalizar,
  platillosDelCatalogo,
  quitarDelCarrito,
  textoDelPedido,
} from "./pedidos";

// Un pedido a medias caduca: quien vuelve al día siguiente a decir "sí" no
// está confirmando los tacos de anoche.
export const VIGENCIA_MS = 3 * 60 * 60 * 1000;

// Cuánto se calla el asistente cuando alguien del restaurante toma el chat.
export const PAUSA_MINUTOS = 120;

// Lo que admite WhatsApp en una lista.
const MAX_FILAS = 10;

// ---------------------------------------------------------------------------
// Los mensajes
// ---------------------------------------------------------------------------

// Un mensaje de salida antes de saber cómo lo quiere la API. La traducción a
// lo que manda Meta, con sus límites de largo, está en `lib/whatsapp-cloud.js`.
const texto = (t) => ({ tipo: "texto", texto: t });
const botones = (t, lista) => ({ tipo: "botones", texto: t, botones: lista.filter(Boolean).slice(0, 3) });
const lista = (t, boton, secciones) => ({ tipo: "lista", texto: t, boton, secciones });

const unir = (...partes) => partes.filter(Boolean).join("\n\n");

// ---------------------------------------------------------------------------
// El estado
// ---------------------------------------------------------------------------

export const ESTADO_INICIAL = {
  paso: null,
  carrito: [],
  origen: null,
  entrega: null,
  direccion: null,
  ubicacion: null,
  nota: null,
  libre: null,
  platillo: null,
  grupo: null,
  dudas: [],
  // El id del mensaje que puso en pantalla la confirmación: viaja con el
  // pedido y la base no deja pasar dos con la misma (ver `orders`).
  clave: null,
  ultimoPedido: null,
  actualizado: null,
};

const PASOS = new Set([
  "seccion",
  "platillo",
  "cantidad",
  "carrito",
  "quitar",
  "aclarar",
  "entrega",
  "direccion",
  "libre",
  "confirmar",
]);

// El estado guardado es un jsonb: se limpia antes de fiarse de él, y el que
// caducó vuelve a empezar (sin olvidar el último pedido mandado).
export function estadoVigente(guardado, ahora = new Date()) {
  const e = guardado && typeof guardado === "object" ? guardado : {};
  const ultimoPedido =
    e.ultimoPedido && typeof e.ultimoPedido.codigo === "string" ? e.ultimoPedido : null;
  const t = Date.parse(e.actualizado ?? "");
  if (!Number.isFinite(t) || ahora.getTime() - t > VIGENCIA_MS) {
    return { ...ESTADO_INICIAL, ultimoPedido };
  }
  return {
    ...ESTADO_INICIAL,
    paso: PASOS.has(e.paso) ? e.paso : null,
    carrito: carritoValido(e.carrito),
    origen: ["chat", "carta", "texto"].includes(e.origen) ? e.origen : null,
    entrega: entregaDe(e.entrega)?.slug ?? null,
    direccion: typeof e.direccion === "string" ? e.direccion.slice(0, MAX_DIRECCION) : null,
    ubicacion:
      e.ubicacion && Number.isFinite(Number(e.ubicacion.lat)) && Number.isFinite(Number(e.ubicacion.lng))
        ? { lat: Number(e.ubicacion.lat), lng: Number(e.ubicacion.lng) }
        : null,
    nota: typeof e.nota === "string" ? e.nota.slice(0, MAX_NOTA_PEDIDO) : null,
    libre: typeof e.libre === "string" ? e.libre.slice(0, MAX_DETALLE) : null,
    platillo: typeof e.platillo === "string" ? e.platillo : null,
    grupo: typeof e.grupo === "string" ? e.grupo : null,
    dudas: Array.isArray(e.dudas) ? e.dudas.filter((d) => Array.isArray(d?.candidatos)).slice(0, 10) : [],
    clave: typeof e.clave === "string" ? e.clave.slice(0, 200) : null,
    ultimoPedido,
    actualizado: e.actualizado,
  };
}

// Lo que se olvida al cerrar un pedido, mandado o cancelado.
function sinPedido(e) {
  return { ...ESTADO_INICIAL, ultimoPedido: e.ultimoPedido };
}

function hayPedidoEnCurso(e) {
  return Boolean(e.paso) || e.carrito.length > 0 || Boolean(e.libre);
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function mayuscula(t) {
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

function enumerar(nombres) {
  const l = nombres.filter(Boolean);
  if (l.length <= 1) return l[0] ?? "";
  return `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}`;
}

// "a la 1 pm", "a las 11 pm": el artículo cambia con la una.
function aLaHora(hhmm) {
  const h = horaLegible(hhmm);
  return `${/^1(\s|:)/.test(h) ? "la" : "las"} ${h}`;
}

// El nombre de pila del perfil de WhatsApp, si parece un nombre: "ANA MARÍA"
// saluda a Ana, "Ing. Carlos" a Carlos, y un perfil que se llama "🌸" o
// "24/7" no saluda a nadie por su nombre.
const TITULOS = new Set(["ing", "lic", "dr", "dra", "arq", "sr", "sra", "srita", "mtro", "mtra", "prof", "don", "doña"]);

export function nombreDePila(nombre) {
  const palabras = String(nombre ?? "").trim().split(/\s+/);
  for (const p of palabras.slice(0, 3)) {
    const m = /^[\p{L}][\p{L}\p{M}]+/u.exec(p);
    if (!m) return null;
    if (TITULOS.has(m[0].toLowerCase())) continue;
    return mayuscula(m[0].toLowerCase());
  }
  return null;
}

// El nombre completo del perfil, para "a nombre de": solo si trae letras.
function nombreDelCliente(nombre) {
  const n = String(nombre ?? "").trim();
  return /\p{L}/u.test(n) ? n.slice(0, 80) : null;
}

function horariosAbiertos(ficha) {
  const cerrados = (ficha.cerrados ?? []).map(Number);
  return (ficha.horarios ?? []).filter((h) => !cerrados.includes(Number(h.weekday)));
}

/**
 * La semana como se dice: "Lunes a viernes: 1 pm a 11 pm". Los días seguidos
 * con el mismo horario se juntan, que en un chat es la diferencia entre tres
 * renglones y siete. Un día marcado cerrado dice "Cerrado", y el que no tiene
 * ni horario ni marca no sale, igual que en la ficha. `null` sin horarios.
 */
export function textoDeSemana(horarios, cerrados = []) {
  const cerradosN = (cerrados ?? []).map(Number);
  const dias = [1, 2, 3, 4, 5, 6, 0].map((dia) => {
    if (cerradosN.includes(dia)) return { dia, texto: "Cerrado" };
    const tramos = (horarios ?? [])
      .filter((h) => Number(h.weekday) === dia)
      .sort((a, b) => String(a.opens).localeCompare(String(b.opens)));
    if (!tramos.length) return null;
    return {
      dia,
      texto: tramos.map((t) => `${horaLegible(t.opens)} a ${horaLegible(t.closes)}`).join(" y "),
    };
  });

  const grupos = [];
  let anterior = null;
  for (const d of dias) {
    if (!d) {
      anterior = null;
      continue;
    }
    if (anterior && anterior.texto === d.texto) {
      anterior.dias.push(d.dia);
    } else {
      anterior = { texto: d.texto, dias: [d.dia] };
      grupos.push(anterior);
    }
  }
  if (!grupos.length) return null;

  return grupos
    .map((g) => {
      const primero = DIAS[g.dias[0]];
      const ultimo = DIAS[g.dias[g.dias.length - 1]];
      const cuales =
        g.dias.length === 1 ? primero : g.dias.length === 2 ? `${primero} y ${ultimo}` : `${primero} a ${ultimo}`;
      return `${mayuscula(cuales)}: ${g.texto}`;
    })
    .join("\n");
}

/**
 * "Ahorita estamos abiertos, hasta las 11 pm." o "Ahorita estamos cerrados.
 * Abrimos mañana a la 1 pm." `null` cuando la ficha no tiene horarios: sin
 * ellos no se sabe, y no se afirma.
 */
export function lineaDeAhora(ficha, ahora = new Date()) {
  const horarios = horariosAbiertos(ficha);
  if (!horarios.length) return null;
  const proxima = proximaApertura(horarios, ficha.zona, ficha.abierto, ahora);
  if (ficha.abierto) {
    return proxima ? `Ahorita estamos abiertos, hasta ${aLaHora(proxima.hora)}.` : "Ahorita estamos abiertos.";
  }
  if (!proxima) return "Ahorita estamos cerrados.";
  // `proximaApertura` ya dice "hoy", "mañana" o el día; se reusa su palabra
  // en vez de recalcularla, así las dos nunca se contradicen.
  const dia = /^Abre (\S+) /.exec(proxima.texto)?.[1] ?? "";
  const cuando = dia === "hoy" || dia === "mañana" ? dia : `el ${dia}`;
  return `Ahorita estamos cerrados. Abrimos ${cuando} a ${aLaHora(proxima.hora)}.`;
}

function respuestaHorario(ctx) {
  const semana = textoDeSemana(horariosAbiertos(ctx.ficha), ctx.ficha.cerrados);
  if (!semana) {
    return `Todavía no tenemos el horario publicado.${
      ctx.ficha.telefono ? ` Para confirmar, llámanos al ${ctx.ficha.telefono}.` : ""
    }`;
  }
  return unir(`Nuestro horario:\n${semana}`, lineaDeAhora(ctx.ficha, ctx.ahora));
}

function respuestaUbicacion(ctx) {
  const { direccion, nombre, telefono } = ctx.ficha;
  if (!direccion) {
    return `Todavía no tenemos la dirección publicada.${telefono ? ` Llámanos al ${telefono} y te decimos cómo llegar.` : ""}`;
  }
  const consulta = encodeURIComponent(`${nombre}, ${direccion}`);
  return `Estamos en ${direccion}.\nCómo llegar: https://www.google.com/maps/search/?api=1&query=${consulta}`;
}

function respuestaWeb(ctx) {
  const { web, urlFicha, redes } = ctx.ficha;
  const renglones = [];
  if (web) renglones.push(`Nuestra página: ${web}`);
  renglones.push(`${web ? "También estamos en" : "Estamos en"} Menú Abierto, con el menú, fotos y reseñas: ${urlFicha}`);
  for (const red of (redes ?? []).slice(0, 3)) renglones.push(`${red.nombre}: ${red.url}`);
  return renglones.join("\n");
}

function respuestaPagos(ctx) {
  const pagos = (ctx.ficha.pagos ?? []).map((p) => p.nombre);
  if (!pagos.length) {
    return `Todavía no publicamos las formas de pago.${
      ctx.ficha.telefono ? ` Pregúntanos al ${ctx.ficha.telefono}.` : ""
    }`;
  }
  return `Aceptamos: ${enumerar(pagos)}.`;
}

function respuestaDomicilio(ctx) {
  const { domicilio, pedidos } = ctx.ficha;
  if (domicilio) {
    return [
      "Sí, tenemos servicio a domicilio.",
      pedidos?.nota ?? null,
      pedidos ? "Puedes pedir por aquí." : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  const llevar = pedidos?.entregas?.some((e) => e.slug === "llevar");
  return `Por ahora no tenemos servicio a domicilio.${llevar ? " Pero puedes pedir para llevar por aquí." : ""}`;
}

function respuestaPlatillos(ctx, ids) {
  const renglones = ids.slice(0, 6).map((id) => {
    const p = ctx.todos.get(id);
    const precio = p.precio != null ? ` — ${pesos(p.precio, p.moneda)}` : "";
    return `${p.nombre}${precio}${ctx.platillos.has(id) ? "" : " (ahorita no se sirve)"}`;
  });
  return `Sí, tenemos:\n${renglones.join("\n")}`;
}

// Las cartas de archivo —un PDF, una foto— se mandan tal cual: es lo que
// alguien espera cuando escribe "me pasas el menú". La digital va como enlace,
// porque en la ficha tiene fotos, precios y el botón para armar el pedido.
function respuestaCarta(ctx) {
  const { ficha } = ctx;
  const menus = ficha.menus ?? [];
  const digitales = menus.filter((m) => m.kind !== "archivo");
  const archivos = menus.filter((m) => m.kind === "archivo" && m.fileUrl).slice(0, 2);

  if (!menus.length) {
    return {
      texto: `Todavía no tenemos el menú publicado.${ficha.telefono ? ` Llámanos al ${ficha.telefono} y te lo decimos.` : ""}`,
      adjuntos: [],
    };
  }

  const invitacion = ficha.pedidos ? "Desde ahí puedes armar tu pedido y mandárnoslo por aquí." : null;
  const adjuntos = archivos.map((m) => {
    const nombre = `${ficha.nombre} - ${m.name}`.replace(/[\\/:*?"<>|]+/g, " ").slice(0, 80);
    return m.fileMime === "application/pdf"
      ? { tipo: "documento", url: m.fileUrl, nombre: `${nombre}.pdf`, texto: m.name }
      : { tipo: "imagen", url: m.fileUrl, texto: m.name };
  });

  if (digitales.length) {
    return { texto: `Aquí está nuestro menú: ${ficha.urlCarta}${invitacion ? `\n${invitacion}` : ""}`, adjuntos };
  }
  // Solo archivos: el primero lleva el texto en su pie y no hace falta otro
  // mensaje.
  if (adjuntos.length) {
    adjuntos[0] = {
      ...adjuntos[0],
      texto: `Nuestro menú.${ficha.pedidos ? " Para pedir, escríbeme lo que quieres." : ""}`,
    };
  }
  return { texto: null, adjuntos };
}

// ---------------------------------------------------------------------------
// Qué quiere
// ---------------------------------------------------------------------------

const INTENCIONES = [
  ["persona", /\b(humano|persona|alguien|asesor|asesora|encargad[oa]|gerente|dueno|duena|operador|hablar con)\b/],
  ["reservar", /\b(reserva|reservar|reservacion|reservaciones|apartar (una )?mesa|mesa para)\b/],
  ["horario", /\b(horarios?|a que hora|hasta que hora|abren|abre|abiertos?|cierran|cierra|cerrados?)\b/],
  ["ubicacion", /\b(donde|direccion|ubicacion|ubicados?|ubican|como llego|mapa|sucursal)\b/],
  ["web", /\b(pagina|web|sitio|link|liga|enlace|internet|facebook|instagram|insta|tiktok|redes)\b/],
  ["pagos", /\b(pagos?|pagar|tarjetas?|efectivo|transferencia|terminal|vales)\b/],
  ["domicilio", /\b(domicilio|envios?|envian|entregan|reparto|delivery)\b/],
  ["carta", /\b(menu|carta|precios|que (tienen|venden|hay)|platillos)\b/],
  ["precio", /\b(cuanto|precio|cuesta|cuestan|vale|valen|costo)\b/],
  [
    "pedir",
    /\b(pedido|pedir|ordenar|encargar|mandame|dame|traeme|regalame|agrega(r|le|me)?|anade(le|me)?|ponle|ponme|sumale|me (das|da|regalas|regala|mandas|manda|traes|trae)|(quiero|quisiera|queria)\b(?! (saber|preguntar|informacion|info|ver|hablar|reservar|conocer)))/,
  ],
  ["gracias", /\b(gracias|grax|thank)/],
  ["saludo", /^(hola|ola|holi|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|hey)\b/],
];

export function intencionesDe(t) {
  const normal = normalizar(t);
  return new Set(INTENCIONES.filter(([, patron]) => patron.test(normal)).map(([slug]) => slug));
}

function esPregunta(crudo) {
  return (
    /[?¿]/.test(crudo) ||
    /^(a que|cuanto|cuantos|cuando|donde|como|tienen|hay|aceptan|puedo|pueden|se puede|me pueden)\b/.test(
      normalizar(crudo),
    )
  );
}

// A "¿lo mandamos?" se contesta de muchas formas: "sí", "sí, confirmo", "sí
// por favor", "Confirmar pedido" tecleado, "ok gracias". Cuenta como sí cuando
// todo lo escrito es de confirmar y al menos una palabra lo dice; "sí, pero sin
// cebolla" no lo es: eso es una nota. Lo mismo para el no.
const PARA_CONFIRMAR = new Set(
  "si sip simon claro confirmo confirmar confirmado confirma va vale ok okay dale listo correcto perfecto adelante mandalo mandalos esta asi bien de acuerdo pedido el mi por favor porfa porfavor gracias todo es eso".split(
    " ",
  ),
);
const DICE_QUE_SI = new Set(
  "si sip simon claro confirmo confirmar confirmado confirma va vale ok okay dale listo correcto perfecto adelante mandalo mandalos bien acuerdo".split(
    " ",
  ),
);
const PARA_CANCELAR = new Set("no nel cancelar cancela cancelalo cancelo ya mejor gracias pedido el mi por favor porfa".split(" "));
const DICE_QUE_NO = new Set("no nel cancelar cancela cancelalo cancelo".split(" "));

function todoDice(t, permitidas, clave) {
  const palabras = t.split(" ").filter(Boolean);
  return palabras.length > 0 && palabras.every((p) => permitidas.has(p)) && palabras.some((p) => clave.has(p));
}

const esSi = (t) => todoDice(t, PARA_CONFIRMAR, DICE_QUE_SI);
const esNo = (t) => todoDice(t, PARA_CANCELAR, DICE_QUE_NO);

// Un "gracias" o un "hola" suelto no es una nota para la cocina.
function esCortesia(t) {
  return /^(gracias|muchas gracias|ok gracias|va gracias|hola|buenas|buen dia)$/.test(t);
}

// Lo que puede acompañar a una cantidad sin cambiarla: "2 porfa", "3 piezas".
const CON_LA_CANTIDAD = new Set("porfa porfavor por favor pz pzs pza pieza piezas orden ordenes nada mas solo".split(" "));

// "2", "dos", "2 porfa": la respuesta a "¿cuántos?". Solo si es eso y nada
// más: "2 de trompo" es otro platillo, no dos del que se estaba pidiendo.
function numeroEn(t) {
  const [primera = "", ...resto] = normalizar(t).split(" ");
  if (!resto.every((p) => CON_LA_CANTIDAD.has(p))) return null;
  const n = /^\d{1,2}$/.test(primera) ? Number(primera) : CUANTOS.get(primera) ?? null;
  return n && n >= 1 && n <= 50 ? n : null;
}

// ---------------------------------------------------------------------------
// Las opciones
// ---------------------------------------------------------------------------

function puedePedirAhora(ctx) {
  return puedePedir(ctx).ok;
}

function sugerencias(ctx, excluir = []) {
  return [
    puedePedirAhora(ctx) && !excluir.includes("pedir") ? { id: "o:pedir", titulo: "Hacer un pedido" } : null,
    !excluir.includes("carta") ? { id: "o:carta", titulo: "Ver el menú" } : null,
    { id: "o:opciones", titulo: "Más opciones" },
  ].filter(Boolean);
}

function mensajeDeOpciones(ctx, encabezado) {
  const { ficha } = ctx;
  const ahora = lineaDeAhora(ficha, ctx.ahora);
  const filas = [
    { id: "o:carta", titulo: "Ver el menú", descripcion: "Platillos y precios" },
    ficha.pedidos
      ? {
          id: "o:pedir",
          titulo: "Hacer un pedido",
          descripcion: enumerar((ficha.pedidos.entregas ?? []).map((e) => e.nombre.toLowerCase())),
        }
      : null,
    { id: "o:horario", titulo: "Horario", descripcion: ahora ? ahora.replace(/^Ahorita /, "") : "" },
    ficha.direccion ? { id: "o:ubicacion", titulo: "Ubicación", descripcion: ficha.direccion } : null,
    { id: "o:web", titulo: "Página y redes", descripcion: ficha.web ? ficha.web.replace(/^https?:\/\//, "") : "" },
    ficha.pagos?.length
      ? { id: "o:pagos", titulo: "Formas de pago", descripcion: enumerar(ficha.pagos.map((p) => p.nombre)) }
      : null,
    { id: "o:persona", titulo: "Hablar con alguien", descripcion: "" },
  ].filter(Boolean);

  return {
    mensajes: [lista(encabezado ?? "¿En qué te ayudo?", "Ver opciones", [{ titulo: ficha.nombre, filas }])],
    estado: ctx.estado,
  };
}

function bienvenida(ctx) {
  const nombre = nombreDePila(ctx.cliente);
  const r = mensajeDeOpciones(
    ctx,
    [
      `¡Hola${nombre ? `, ${nombre}` : ""}! Soy el asistente de ${ctx.ficha.nombre}.`,
      lineaDeAhora(ctx.ficha, ctx.ahora),
      "¿En qué te ayudo?",
    ]
      .filter(Boolean)
      .join(" "),
  );
  return { ...r, saludado: true };
}

function noEntendi(ctx, encabezado = "Perdón, no te entendí.") {
  const ejemplo = ctx.catalogo[0]?.platillos[0]?.nombre;
  return mensajeDeOpciones(
    ctx,
    `${encabezado} Elige una opción, o escríbeme por ejemplo: "¿a qué hora abren?"${
      ejemplo && ctx.ficha.pedidos ? ` o "quiero 2 ${ejemplo.toLowerCase()}"` : ""
    }.`,
  );
}

function persona(ctx, antes = "") {
  const { ficha } = ctx;
  if (ficha.atiendeEnApp) {
    return {
      mensajes: [
        texto(
          `${antes}Listo, ya le avisé al equipo de ${ficha.nombre}: te contestan por aquí en cuanto puedan.${
            ficha.telefono ? ` Si es urgente, llámanos al ${ficha.telefono}.` : ""
          }`,
        ),
      ],
      estado: ctx.estado,
      pausar: PAUSA_MINUTOS,
    };
  }
  if (ficha.telefono) {
    return {
      mensajes: [botones(`${antes}Para hablar con alguien de ${ficha.nombre}, llámanos al ${ficha.telefono}.`, sugerencias(ctx))],
      estado: ctx.estado,
    };
  }
  return mensajeDeOpciones(ctx, `${antes}Por ahora aquí solo contesto yo, pero te puedo ayudar con esto:`);
}

// Las respuestas informativas de un mensaje van juntas: "¿a qué hora abren y
// dónde están?" es una pregunta con dos respuestas y un solo mensaje.
function responderConBloques(ctx, bloques, excluir = []) {
  const cuerpo = unir(...bloques.map((b) => b.texto));
  const adjuntos = bloques.flatMap((b) => b.adjuntos ?? []);
  // A media orden, la respuesta lleva de vuelta al paso en que iba.
  if (hayPedidoEnCurso(ctx.estado) && ctx.estado.paso && puedePedirAhora(ctx)) {
    const r = repetirPaso(ctx, cuerpo);
    return { ...r, mensajes: [...adjuntos, ...r.mensajes] };
  }
  const mensajes = [...adjuntos];
  if (cuerpo) mensajes.push(botones(cuerpo, sugerencias(ctx, excluir)));
  return { mensajes, estado: ctx.estado };
}

// ---------------------------------------------------------------------------
// El pedido
// ---------------------------------------------------------------------------

function puedePedir(ctx) {
  const { ficha } = ctx;
  if (!ficha.pedidos) {
    return {
      ok: false,
      texto: `Por ahora no tomamos pedidos por WhatsApp. El menú está aquí: ${ficha.urlCarta}${
        ficha.telefono ? `\nSi quieres pedir, llámanos al ${ficha.telefono}.` : ""
      }`,
    };
  }
  if (horariosAbiertos(ficha).length && !ficha.abierto) {
    return {
      ok: false,
      texto: `${lineaDeAhora(ficha, ctx.ahora)} Por eso no podemos tomar tu pedido ahorita.\nMientras, aquí está el menú: ${ficha.urlCarta}`,
    };
  }
  const digitales = (ficha.menus ?? []).some((m) => m.kind !== "archivo" && (m.grupos ?? []).length);
  if (digitales && !ctx.catalogo.length) {
    return {
      ok: false,
      texto: `A esta hora no tenemos menú para pedir. Aquí puedes ver cuándo se sirve cada uno: ${ficha.urlCarta}`,
    };
  }
  return { ok: true, modo: ctx.catalogo.length ? "carta" : "libre" };
}

function noSePuede(ctx, p, encabezado = null) {
  return {
    mensajes: [botones(unir(encabezado, p.texto), sugerencias(ctx, ["pedir"]))],
    estado: hayPedidoEnCurso(ctx.estado) ? sinPedido(ctx.estado) : ctx.estado,
  };
}

// Toda opción del pedido pasa por aquí: un botón viejo del chat se puede tocar
// horas después, cuando el local ya cerró.
function conPedido(ctx, seguir) {
  const p = puedePedir(ctx);
  if (!p.ok) return noSePuede(ctx, p);
  return seguir(p);
}

function paginar(filas, pagina, masId, extras = []) {
  const cupo = MAX_FILAS - extras.length;
  if (filas.length <= cupo) return [...filas, ...extras];
  const porPagina = cupo - 1;
  const paginas = Math.ceil(filas.length / porPagina);
  const actual = Math.min(Math.max(pagina, 0), paginas - 1);
  const inicio = actual * porPagina;
  const trozo = filas.slice(inicio, inicio + porPagina);
  const hayMas = actual < paginas - 1;
  const restantes = filas.length - inicio - trozo.length;
  return [
    ...trozo,
    hayMas
      ? { id: masId(actual + 1), titulo: "Ver más", descripcion: `${restantes} más` }
      : { id: masId(0), titulo: "Volver al principio", descripcion: "" },
    ...extras,
  ];
}

function mensajeDeGrupos(ctx, pagina = 0, encabezado = null) {
  const grupos = ctx.catalogo;
  if (!grupos.length) {
    return noSePuede(ctx, { texto: `A esta hora no tenemos menú para pedir: ${ctx.ficha.urlCarta}` }, encabezado);
  }
  if (grupos.length === 1) return mensajeDePlatillos(ctx, grupos[0].id, 0, encabezado);

  const filas = paginar(
    grupos.map((g) => ({
      id: `g:${g.id}`,
      titulo: g.nombre,
      descripcion: [g.carta, `${g.platillos.length} ${g.platillos.length === 1 ? "platillo" : "platillos"}`]
        .filter(Boolean)
        .join(" · "),
    })),
    pagina,
    (p) => `g+:${p}`,
  );
  const ejemplo = grupos[0]?.platillos[0]?.nombre;
  return {
    mensajes: [
      lista(
        unir(
          encabezado,
          `¿Qué se te antoja? Elige una sección del menú.${
            ejemplo ? ` También puedes escribirme tu pedido, por ejemplo: "2 ${ejemplo.toLowerCase()}".` : ""
          }`,
        ),
        "Ver el menú",
        [{ titulo: "Secciones", filas }],
      ),
    ],
    estado: { ...ctx.estado, paso: "seccion", grupo: null, platillo: null, origen: ctx.estado.origen ?? "chat" },
  };
}

function mensajeDePlatillos(ctx, grupoId, pagina = 0, encabezado = null) {
  const grupo = ctx.catalogo.find((g) => g.id === grupoId);
  if (!grupo) return mensajeDeGrupos(ctx, 0, "Esa sección ya no está disponible.");

  const extras = ctx.catalogo.length > 1 ? [{ id: "g+:0", titulo: "Otras secciones", descripcion: "" }] : [];
  const filas = paginar(
    grupo.platillos.map((p) => ({
      id: `p:${p.id}`,
      titulo: p.nombre,
      // El título de una fila se corta a los 24 caracteres; el nombre
      // completo va en la descripción para que nadie pida a ciegas.
      descripcion: [
        p.nombre.length > 24 ? p.nombre : null,
        p.precio != null ? pesos(p.precio, p.moneda) : null,
        p.descripcion,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    pagina,
    (n) => `pm:${grupo.id}:${n}`,
    extras,
  );
  return {
    mensajes: [lista(unir(encabezado, `${grupo.nombre}: elige un platillo.`), "Ver platillos", [{ titulo: grupo.nombre, filas }])],
    estado: { ...ctx.estado, paso: "platillo", grupo: grupo.id, platillo: null, origen: ctx.estado.origen ?? "chat" },
  };
}

function preguntarCantidad(ctx, platillo, encabezado = null) {
  const precio = platillo.precio != null ? ` (${pesos(platillo.precio, platillo.moneda)} c/u)` : "";
  return {
    mensajes: [
      botones(unir(encabezado, `${platillo.nombre}${precio}.\n¿Cuántos quieres? Toca un número o escríbelo.`), [
        { id: "c:1", titulo: "1" },
        { id: "c:2", titulo: "2" },
        { id: "c:3", titulo: "3" },
      ]),
    ],
    estado: { ...ctx.estado, paso: "cantidad", platillo: platillo.id, origen: ctx.estado.origen ?? "chat" },
  };
}

function agregar(ctx, id, cantidad) {
  const platillo = ctx.platillos.get(id);
  if (!platillo) return mensajeDeGrupos(ctx, 0, "Ese platillo ya no está disponible.");
  const carrito = agregarAlCarrito(ctx.estado.carrito, platillo, cantidad);
  return mensajeDelCarrito(
    { ...ctx, estado: { ...ctx.estado, carrito, platillo: null } },
    `Agregué ${cantidad} × ${platillo.nombre}.`,
  );
}

function mensajeDelCarrito(ctx, encabezado = null) {
  const { lineas, faltan } = lineasDelCarrito(ctx.estado.carrito, ctx.platillos);
  const estado = {
    ...ctx.estado,
    carrito: ctx.estado.carrito.filter((l) => ctx.platillos.has(l.id)),
  };
  const aviso = faltan.length ? `Esto ya no está disponible y lo quité: ${enumerar(faltan)}.` : null;
  if (!lineas.length) {
    return mensajeDeGrupos({ ...ctx, estado }, 0, unir(encabezado, aviso, "Tu pedido está vacío."));
  }
  return {
    mensajes: [
      botones(unir(encabezado, aviso, `Tu pedido:\n${textoDelPedido(lineas)}`), [
        { id: "k:agregar", titulo: "Agregar más" },
        { id: "k:quitar", titulo: "Quitar algo" },
        { id: "k:terminar", titulo: "Terminar pedido" },
      ]),
    ],
    estado: { ...estado, paso: "carrito" },
  };
}

function mensajeParaQuitar(ctx) {
  const { lineas } = lineasDelCarrito(ctx.estado.carrito, ctx.platillos);
  if (!lineas.length) return mensajeDelCarrito(ctx);
  const filas = [
    ...lineas.slice(0, MAX_FILAS - 1).map((l) => ({
      id: `q:${l.id}`,
      titulo: l.nombre,
      descripcion: `${l.cantidad} en el pedido`,
    })),
    { id: "q:*", titulo: "Vaciar el pedido", descripcion: "Quitar todo y empezar de nuevo" },
  ];
  return {
    mensajes: [lista("¿Qué quitamos?", "Ver mi pedido", [{ titulo: "Tu pedido", filas }])],
    estado: { ...ctx.estado, paso: "quitar" },
  };
}

function preguntarDuda(ctx, encabezado = null) {
  const [duda] = ctx.estado.dudas;
  const filas = [
    ...duda.candidatos
      .map((c) => ctx.platillos.get(c.id))
      .filter(Boolean)
      .slice(0, MAX_FILAS - 1)
      .map((p) => ({
        id: `a:${p.id}`,
        titulo: p.nombre,
        descripcion: [p.nombre.length > 24 ? p.nombre : null, p.precio != null ? pesos(p.precio, p.moneda) : null]
          .filter(Boolean)
          .join(" · "),
      })),
    { id: "a:ninguno", titulo: "Ninguno de estos", descripcion: "" },
  ];
  return {
    mensajes: [
      lista(
        unir(encabezado, `¿Cuál de estos querías${duda.texto ? ` por "${duda.texto}"` : ""}? (${duda.cantidad})`),
        "Ver opciones",
        [{ titulo: "Elige uno", filas }],
      ),
    ],
    estado: { ...ctx.estado, paso: "aclarar" },
  };
}

function preguntarEntrega(ctx, encabezado = null) {
  return {
    mensajes: [
      botones(
        unir(encabezado, "¿Cómo lo quieres?"),
        ctx.ficha.pedidos.entregas.map((e) => ({ id: `e:${e.slug}`, titulo: e.nombre })),
      ),
    ],
    estado: { ...ctx.estado, paso: "entrega" },
  };
}

function preguntarDireccion(ctx, encabezado = null) {
  return {
    mensajes: [
      texto(
        unir(
          encabezado,
          "¿A dónde te lo llevamos? Escribe la dirección con calle, número y colonia, o comparte tu ubicación desde el clip.",
          ctx.ficha.pedidos.nota,
        ),
      ),
    ],
    estado: { ...ctx.estado, paso: "direccion" },
  };
}

function preguntarLibre(ctx, encabezado = null) {
  return {
    mensajes: [
      texto(
        unir(
          encabezado,
          `Escríbeme tu pedido en un mensaje, como lo pedirías en el mostrador. Por ejemplo: "2 órdenes de tacos de trompo y una horchata".\nEl menú está aquí: ${ctx.ficha.urlCarta}`,
        ),
      ),
    ],
    estado: { ...ctx.estado, paso: "libre", origen: "texto" },
  };
}

function mensajeDeConfirmacion(ctx, encabezado = null) {
  const e = ctx.estado;
  const { lineas } = lineasDelCarrito(e.carrito, ctx.platillos);
  // Si entretanto todo se agotó, no hay nada que confirmar: el carrito lo dice.
  if (!lineas.length && !e.libre) return mensajeDelCarrito(ctx, encabezado);
  const entrega = entregaDe(e.entrega);
  const nombre = nombreDelCliente(ctx.cliente);
  const detalle = [
    lineas.length ? textoDelPedido(lineas) : `"${e.libre}"`,
    [entrega?.nombre, nombre ? `a nombre de ${nombre}` : null].filter(Boolean).join(" · ") || null,
    e.entrega === "domicilio"
      ? `Entrega en: ${e.direccion ?? "la ubicación que compartiste"}`
      : null,
    e.nota ? `Nota: ${e.nota}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    mensajes: [
      botones(
        unir(
          encabezado,
          `Revisa tu pedido para ${ctx.ficha.nombre}:\n${detalle}`,
          ctx.ficha.pedidos?.nota,
          "¿Lo mandamos? Si quieres agregar una nota (sin cebolla, sin hielo…), escríbela antes de confirmar.",
        ),
        [
          { id: "f:confirmar", titulo: "Confirmar pedido" },
          { id: "f:cambiar", titulo: "Cambiar algo" },
          { id: "f:cancelar", titulo: "Cancelar" },
        ],
      ),
    ],
    estado: { ...e, paso: "confirmar", clave: ctx.entrada?.id ?? e.clave ?? null },
  };
}

// De "terminar" en adelante: cómo lo quiere, a dónde, y la confirmación. Cada
// dato que ya se tiene —porque venía en el mensaje de la carta, o porque lo
// escribió— se salta.
function terminar(ctx, encabezado = null) {
  const e = ctx.estado;
  if (!e.libre && !lineasDelCarrito(e.carrito, ctx.platillos).lineas.length) {
    return mensajeDelCarrito(ctx, encabezado);
  }
  const entregas = ctx.ficha.pedidos.entregas ?? [];
  const valida = entregas.some((x) => x.slug === e.entrega);
  let estado = valida ? e : { ...e, entrega: entregas.length === 1 ? entregas[0].slug : null };
  const siguiente = { ...ctx, estado };

  if (!estado.entrega && entregas.length > 1) return preguntarEntrega(siguiente, encabezado);
  if (estado.entrega === "domicilio" && !estado.direccion && !estado.ubicacion) {
    return preguntarDireccion(siguiente, encabezado);
  }
  return mensajeDeConfirmacion(siguiente, encabezado);
}

function cancelar(ctx) {
  const habia = hayPedidoEnCurso(ctx.estado);
  return {
    mensajes: [
      botones(habia ? "Listo, cancelé el pedido." : "No tienes ningún pedido abierto.", [
        puedePedirAhora(ctx) ? { id: "o:pedir", titulo: "Hacer otro pedido" } : null,
        { id: "o:opciones", titulo: "Más opciones" },
      ]),
    ],
    estado: sinPedido(ctx.estado),
  };
}

function confirmar(ctx) {
  const p = puedePedir(ctx);
  if (!p.ok) return noSePuede(ctx, p);

  const e = ctx.estado;
  const { lineas, faltan } = lineasDelCarrito(e.carrito, ctx.platillos);
  if (faltan.length) {
    // Entre que se armó y se confirmó, algo se agotó o su carta dejó de
    // servirse: se enseña el pedido como queda antes de mandarlo.
    const estado = { ...e, carrito: e.carrito.filter((l) => ctx.platillos.has(l.id)) };
    if (!lineas.length && !e.libre) {
      return mensajeDeGrupos({ ...ctx, estado }, 0, `Ya no está disponible: ${enumerar(faltan)}.`);
    }
    return mensajeDeConfirmacion({ ...ctx, estado }, `Ya no está disponible y lo quité: ${enumerar(faltan)}.`);
  }
  if (!lineas.length && !e.libre) return mensajeDeGrupos(ctx, 0, "Tu pedido está vacío.");
  if (e.entrega === "domicilio" && !e.direccion && !e.ubicacion) return preguntarDireccion(ctx);

  return {
    mensajes: [],
    estado: sinPedido(e),
    // Si guardarlo falla, el chat vuelve aquí para que "Confirmar" se pueda
    // tocar otra vez.
    estadoSiFalla: e,
    pedido: {
      origen: e.origen ?? (e.libre ? "texto" : "chat"),
      lineas,
      libre: lineas.length ? null : e.libre,
      entrega: e.entrega,
      direccion: e.direccion,
      ubicacion: e.ubicacion,
      nota: e.nota,
      clave: e.clave,
    },
  };
}

/**
 * Lo que se le contesta al cliente cuando su pedido ya quedó guardado. Va
 * aparte de `responder` porque el código lo da la base al insertar.
 */
export function confirmacionDePedido(ficha, { codigo, cliente = null }) {
  const nombre = nombreDePila(cliente);
  return [
    texto(
      [
        `¡Listo${nombre ? `, ${nombre}` : ""}! Recibimos tu pedido. Tu número de pedido es ${codigo}.`,
        "Te avisamos por aquí en cuanto lo aceptemos.",
        ficha.telefono ? `Si necesitas algo más, llámanos al ${ficha.telefono}.` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ];
}

export function errorAlGuardar() {
  return [texto("Perdón, no pudimos registrar tu pedido por un error nuestro. Toca \"Confirmar pedido\" otra vez en un momento.")];
}

// Empezar a pedir, con lo que ya se entendió del mensaje (si algo).
function empezarPedido(ctx, leido = null, crudo = "") {
  return conPedido(ctx, (p) => {
    const e = ctx.estado;
    if (p.modo === "libre") {
      // Sin carta digital no hay platillos que elegir: el pedido va como lo
      // escribió. Si el mensaje ya traía cantidades, ese es el pedido.
      if (leido?.conCantidad || /\d/.test(crudo)) {
        const estado = { ...e, libre: crudo.trim().slice(0, MAX_DETALLE), origen: "texto", entrega: leido?.entrega ?? e.entrega };
        return terminar({ ...ctx, estado });
      }
      return preguntarLibre(ctx);
    }

    let carrito = e.carrito;
    for (const l of leido?.lineas ?? []) carrito = agregarAlCarrito(carrito, ctx.platillos.get(l.id), l.cantidad);
    const estado = {
      ...e,
      carrito,
      dudas: [...(leido?.dudas ?? [])],
      origen: e.origen ?? (leido?.lineas?.length || leido?.dudas?.length ? "texto" : "chat"),
      entrega: leido?.entrega ?? e.entrega,
    };
    const siguiente = { ...ctx, estado };
    const aviso = leido?.sinEncontrar?.length
      ? `No encontré en el menú: ${enumerar(leido.sinEncontrar.map((s) => `"${s}"`))}.`
      : null;

    if (estado.dudas.length) return preguntarDuda(siguiente, aviso);
    if (carrito.length) return mensajeDelCarrito(siguiente, aviso);
    return mensajeDeGrupos(siguiente, 0, aviso);
  });
}

// El mensaje que armó la carta de la ficha. Ya viene elegido y revisado, así
// que va directo a cómo lo quiere y a la confirmación.
function desdeLaCarta(ctx, leido) {
  return conPedido(ctx, (p) => {
    if (p.modo === "libre") return empezarPedido(ctx);
    let carrito = [];
    for (const l of leido.lineas) carrito = agregarAlCarrito(carrito, ctx.platillos.get(l.id), l.cantidad);

    // Un renglón que el cliente editó antes de mandar se intenta leer como
    // texto libre en vez de darlo por perdido. Lo que tampoco así aparece
    // —un platillo de una carta que ya no se sirve— se dice con su nombre.
    const dudas = [];
    const perdidos = [];
    for (const l of leido.sinEncontrar) {
      const rescate = interpretarPedido(`${l.cantidad} ${l.nombre}`, ctx.platillos);
      for (const r of rescate.lineas) carrito = agregarAlCarrito(carrito, ctx.platillos.get(r.id), r.cantidad);
      dudas.push(...rescate.dudas);
      if (!rescate.lineas.length && !rescate.dudas.length) perdidos.push(l.nombre);
    }

    const estado = { ...sinPedido(ctx.estado), carrito, dudas, origen: "carta", entrega: leido.entrega };
    const siguiente = { ...ctx, estado };
    const aviso = perdidos.length ? `Esto no lo encontré en el menú de ahorita: ${enumerar(perdidos)}.` : null;

    if (!carrito.length && !estado.dudas.length) {
      return mensajeDeGrupos(siguiente, 0, unir(aviso, "Arma tu pedido desde aquí:"));
    }
    if (estado.dudas.length) return preguntarDuda(siguiente, unir("Recibí tu pedido de la carta.", aviso));
    return terminar(siguiente, unir("Recibí tu pedido de la carta.", aviso));
  });
}

// Lo que se vuelve a preguntar cuando llega algo que el paso no esperaba. Si
// entretanto el local cerró o el dueño apagó los pedidos, eso es lo que se
// dice, y el pedido a medias se olvida.
function repetirPaso(ctx, encabezado = null) {
  const e = ctx.estado;
  const p = puedePedir(ctx);
  if (!p.ok) return noSePuede(ctx, p, encabezado);
  switch (e.paso) {
    case "seccion":
      return mensajeDeGrupos(ctx, 0, encabezado);
    case "platillo":
      return mensajeDePlatillos(ctx, e.grupo, 0, encabezado);
    case "cantidad": {
      const p = ctx.platillos.get(e.platillo);
      return p ? preguntarCantidad(ctx, p, encabezado) : mensajeDeGrupos(ctx, 0, encabezado);
    }
    case "aclarar":
      return e.dudas.length ? preguntarDuda(ctx, encabezado) : mensajeDelCarrito(ctx, encabezado);
    case "entrega":
      return preguntarEntrega(ctx, encabezado);
    case "direccion":
      return preguntarDireccion(ctx, encabezado);
    case "libre":
      return preguntarLibre(ctx, encabezado);
    case "confirmar":
      return mensajeDeConfirmacion(ctx, encabezado);
    default:
      return mensajeDelCarrito(ctx, encabezado);
  }
}

// ---------------------------------------------------------------------------
// Por tipo de mensaje
// ---------------------------------------------------------------------------

function porOpcion(ctx, id) {
  const i = String(id ?? "").indexOf(":");
  const clave = i < 0 ? String(id ?? "") : id.slice(0, i);
  const valor = i < 0 ? "" : id.slice(i + 1);
  const e = ctx.estado;

  switch (clave) {
    case "o":
      return porOpcionDeInicio(ctx, valor);
    case "g":
      return conPedido(ctx, () => mensajeDePlatillos(ctx, valor, 0));
    case "g+":
      return conPedido(ctx, () => mensajeDeGrupos(ctx, Number(valor) || 0));
    case "pm": {
      const corte = valor.lastIndexOf(":");
      return conPedido(ctx, () =>
        mensajeDePlatillos(ctx, valor.slice(0, corte), Number(valor.slice(corte + 1)) || 0),
      );
    }
    case "p":
      return conPedido(ctx, () => {
        const p = ctx.platillos.get(valor);
        return p ? preguntarCantidad(ctx, p) : mensajeDeGrupos(ctx, 0, "Ese platillo ya no está disponible.");
      });
    case "c":
      if (e.paso === "cantidad" && e.platillo) {
        return conPedido(ctx, () => agregar(ctx, e.platillo, Number(valor) || 1));
      }
      return hayPedidoEnCurso(e) ? repetirPaso(ctx) : noEntendi(ctx, "Ese botón ya no está vigente.");
    case "k":
      if (valor === "agregar") return conPedido(ctx, () => mensajeDeGrupos(ctx, 0));
      if (valor === "quitar") return conPedido(ctx, () => mensajeParaQuitar(ctx));
      if (valor === "terminar") {
        return conPedido(ctx, () =>
          e.carrito.length ? terminar(ctx) : mensajeDeGrupos(ctx, 0, "Tu pedido está vacío."),
        );
      }
      return noEntendi(ctx);
    case "q": {
      const carrito = valor === "*" ? [] : quitarDelCarrito(e.carrito, valor);
      return conPedido(ctx, () =>
        mensajeDelCarrito({ ...ctx, estado: { ...e, carrito } }, valor === "*" ? "Vacié tu pedido." : "Listo, lo quité."),
      );
    }
    case "a": {
      if (e.paso !== "aclarar" || !e.dudas.length) {
        return hayPedidoEnCurso(e) ? repetirPaso(ctx) : noEntendi(ctx, "Ese botón ya no está vigente.");
      }
      const [duda, ...resto] = e.dudas;
      const p = ctx.platillos.get(valor);
      const carrito = p ? agregarAlCarrito(e.carrito, p, duda.cantidad) : e.carrito;
      const estado = { ...e, carrito, dudas: resto };
      const siguiente = { ...ctx, estado };
      if (resto.length) return preguntarDuda(siguiente, p ? `Agregué ${duda.cantidad} × ${p.nombre}.` : null);
      return conPedido(siguiente, () =>
        carrito.length
          ? mensajeDelCarrito(siguiente, p ? `Agregué ${duda.cantidad} × ${p.nombre}.` : null)
          : mensajeDeGrupos(siguiente, 0, "Elige del menú:"),
      );
    }
    case "e": {
      const valida = (ctx.ficha.pedidos?.entregas ?? []).some((x) => x.slug === valor);
      if (!valida || (!e.carrito.length && !e.libre)) {
        return hayPedidoEnCurso(e) ? repetirPaso(ctx) : noEntendi(ctx, "Ese botón ya no está vigente.");
      }
      return conPedido(ctx, () => terminar({ ...ctx, estado: { ...e, entrega: valor } }));
    }
    case "f":
      if (valor === "cancelar") return cancelar(ctx);
      if (e.paso !== "confirmar") {
        if (e.ultimoPedido) {
          return {
            mensajes: [botones(`Tu pedido ${e.ultimoPedido.codigo} ya lo recibimos.`, sugerencias(ctx))],
            estado: e,
          };
        }
        return hayPedidoEnCurso(e) ? repetirPaso(ctx) : noEntendi(ctx, "Ese pedido ya no está abierto.");
      }
      if (valor === "confirmar") return confirmar(ctx);
      if (valor === "cambiar") {
        return e.libre && !e.carrito.length
          ? preguntarLibre({ ...ctx, estado: { ...e, libre: null } })
          : conPedido(ctx, () => mensajeDelCarrito(ctx));
      }
      return repetirPaso(ctx);
    default:
      return noEntendi(ctx);
  }
}

function porOpcionDeInicio(ctx, valor) {
  switch (valor) {
    case "carta":
      return responderConBloques(ctx, [respuestaCarta(ctx)], ["carta"]);
    case "pedir":
      // Si ya iba armando uno, se retoma en vez de empezar de cero.
      return hayPedidoEnCurso(ctx.estado) ? conPedido(ctx, () => repetirPaso(ctx)) : empezarPedido(ctx);
    case "horario":
      return responderConBloques(ctx, [{ texto: respuestaHorario(ctx) }]);
    case "ubicacion":
      return responderConBloques(ctx, [{ texto: respuestaUbicacion(ctx) }]);
    case "web":
      return responderConBloques(ctx, [{ texto: respuestaWeb(ctx) }]);
    case "pagos":
      return responderConBloques(ctx, [{ texto: respuestaPagos(ctx) }]);
    case "persona":
      return persona(ctx);
    default:
      return mensajeDeOpciones(ctx);
  }
}

function porUbicacion(ctx) {
  const e = ctx.estado;
  const u = ctx.entrada.ubicacion ?? {};
  if (e.paso !== "direccion") {
    return mensajeDeOpciones(ctx, "Recibí tu ubicación. ¿En qué te ayudo?");
  }
  const lat = Number(u.lat);
  const lng = Number(u.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return conPedido(ctx, () => preguntarDireccion(ctx, "No pude leer esa ubicación."));
  }
  const direccion =
    [u.nombre, u.direccion].filter(Boolean).join(", ").slice(0, MAX_DIRECCION) || null;
  const estado = { ...e, ubicacion: { lat, lng }, direccion };
  return conPedido(ctx, () => terminar({ ...ctx, estado }));
}

function porTexto(ctx) {
  const crudo = String(ctx.entrada.texto ?? "").trim();
  const t = normalizar(crudo);
  const e = ctx.estado;
  if (!t) return noEntendi(ctx);

  // Las salidas que valen en cualquier paso.
  if (/^(cancelar|cancela|cancelalo|cancelo|ya no quiero)\b/.test(t) && hayPedidoEnCurso(e)) return cancelar(ctx);
  if (/^(opciones|inicio|ayuda|menu principal)$/.test(t)) return mensajeDeOpciones(ctx);

  // Los pasos que esperan algo escrito.
  if (e.paso === "cantidad" && e.platillo) {
    const n = numeroEn(t);
    if (n) return conPedido(ctx, () => agregar(ctx, e.platillo, n));
  }
  if (e.paso === "confirmar") {
    if (esSi(t)) return confirmar(ctx);
    if (esNo(t)) return cancelar(ctx);
    if (esCortesia(t)) return mensajeDeConfirmacion(ctx);
  }
  if (e.paso === "entrega") {
    // Aquí basta la palabra suelta: a "¿cómo lo quieres?" se contesta
    // "llevar", no "para llevar, por favor".
    const suelta = /\bllevar\b/.test(t)
      ? "llevar"
      : /\b(aqui|comer|local)\b/.test(t)
        ? "sitio"
        : /\b(domicilio|envio|enviar)\b/.test(t)
          ? "domicilio"
          : null;
    const dicha = entregaEnTexto(crudo) ?? suelta;
    if (dicha && (ctx.ficha.pedidos?.entregas ?? []).some((x) => x.slug === dicha)) {
      return conPedido(ctx, () => terminar({ ...ctx, estado: { ...e, entrega: dicha } }));
    }
  }
  if (e.paso === "direccion" && !esPregunta(crudo)) {
    // "Mejor para llevar" cambia la entrega; no es una dirección.
    const otra = entregaEnTexto(crudo) ?? (/\b(llevar|recoger|paso por)\b/.test(t) ? "llevar" : null);
    if (otra && otra !== "domicilio" && (ctx.ficha.pedidos?.entregas ?? []).some((x) => x.slug === otra)) {
      return conPedido(ctx, () => terminar({ ...ctx, estado: { ...e, entrega: otra, direccion: null, ubicacion: null } }));
    }
    if (crudo.length >= 8) {
      return conPedido(ctx, () =>
        terminar({ ...ctx, estado: { ...e, direccion: crudo.slice(0, MAX_DIRECCION), ubicacion: null } }),
      );
    }
  }
  if (e.paso === "libre" && !esPregunta(crudo) && crudo.length >= 3) {
    return conPedido(ctx, () => terminar({ ...ctx, estado: { ...e, libre: crudo.slice(0, MAX_DETALLE) } }));
  }

  // El pedido que armó la carta de la ficha.
  const deLaCarta = leerMensajeDeLaCarta(crudo, ctx.platillos);
  if (deLaCarta) return desdeLaCarta(ctx, deLaCarta);

  const quiere = intencionesDe(crudo);
  if (quiere.has("persona")) return persona(ctx);
  if (quiere.has("reservar")) return persona(ctx, "Para reservar mesa: ");

  // Platillos en el texto: ¿los está pidiendo o preguntando por ellos? A media
  // orden basta nombrarlos ("y una horchata"). En la confirmación no: ahí lo
  // escrito es la nota ("sin cebolla en los de pastor"), salvo que traiga
  // cantidad o un "quiero".
  const leido = ctx.platillos.size ? interpretarPedido(crudo, ctx.platillos) : null;
  const conPlatillos = Boolean(leido && (leido.lineas.length || leido.dudas.length));
  const pregunta = esPregunta(crudo);
  const pidiendo =
    e.paso === "confirmar"
      ? conPlatillos && !pregunta && (leido.conCantidad || quiere.has("pedir"))
      : quiere.has("pedir") || (conPlatillos && !pregunta && (leido.conCantidad || hayPedidoEnCurso(e)));
  if (pidiendo) {
    // A media orden, lo que se escribe se suma a lo que ya lleva.
    if (hayPedidoEnCurso(e) && !conPlatillos && e.paso) return conPedido(ctx, () => repetirPaso(ctx));
    return empezarPedido(ctx, leido, crudo);
  }

  // La nota del pedido: lo que se escribe en la confirmación y no es otra
  // cosa.
  if (e.paso === "confirmar" && !pregunta) {
    const nota = [e.nota, crudo].filter(Boolean).join(". ").slice(0, MAX_NOTA_PEDIDO);
    return conPedido(ctx, () => mensajeDeConfirmacion({ ...ctx, estado: { ...e, nota } }, "Agregué la nota."));
  }

  // Lo que se pregunta.
  const bloques = [];
  const excluir = [];
  if (quiere.has("horario")) bloques.push({ texto: respuestaHorario(ctx) });
  if (quiere.has("ubicacion")) bloques.push({ texto: respuestaUbicacion(ctx) });
  if (quiere.has("web")) bloques.push({ texto: respuestaWeb(ctx) });
  if (quiere.has("pagos")) bloques.push({ texto: respuestaPagos(ctx) });
  if (quiere.has("domicilio")) bloques.push({ texto: respuestaDomicilio(ctx) });

  const porPrecio = interpretarPedido(crudo, ctx.todos);
  const ids = [
    ...new Set([...porPrecio.lineas.map((l) => l.id), ...porPrecio.dudas.flatMap((d) => d.candidatos.map((c) => c.id))]),
  ];
  if (ids.length) {
    bloques.push({ texto: respuestaPlatillos(ctx, ids) });
  } else if (quiere.has("carta") || quiere.has("precio")) {
    bloques.push(respuestaCarta(ctx));
    excluir.push("carta");
  }
  if (bloques.length) return responderConBloques(ctx, bloques, excluir);

  // A media orden, lo que no se entiende devuelve al paso en que iba.
  if (hayPedidoEnCurso(e) && e.paso) {
    return conPedido(ctx, () => repetirPaso(ctx, quiere.has("gracias") ? "¡Con gusto!" : "No encontré eso en el menú."));
  }

  if (quiere.has("gracias")) return { mensajes: [texto("¡Con gusto! Aquí estamos.")], estado: e };
  if (quiere.has("saludo") || ctx.nuevo) return bienvenida(ctx);
  return noEntendi(ctx);
}

// ---------------------------------------------------------------------------
// La entrada
// ---------------------------------------------------------------------------

/**
 * Qué contestar a un mensaje.
 *
 * - `ficha`: lo que el asistente sabe del restaurante (ver `atender.js`).
 * - `chat`: `{ estado, nombre, pausadoHasta, nuevo }`.
 * - `entrada`: el mensaje ya leído del webhook (`lib/whatsapp-cloud.js`).
 *
 * Devuelve `{ mensajes, estado }`, más `pedido` cuando el cliente confirmó
 * (quien llama lo guarda y contesta con `confirmacionDePedido`) y `pausar`
 * cuando pidió hablar con alguien del restaurante.
 */
export function responder({ ficha, chat = {}, entrada, ahora = new Date() }) {
  const estado = estadoVigente(chat.estado, ahora);

  // Alguien del restaurante tomó el chat: el asistente no se mete.
  const pausa = Date.parse(chat.pausadoHasta ?? "");
  if (Number.isFinite(pausa) && pausa > ahora.getTime()) {
    return { mensajes: [], estado: chat.estado ?? estado };
  }

  const catalogo = catalogoParaPedir(ficha.menus, ficha.zona, ahora);
  const ctx = {
    ficha,
    estado,
    entrada,
    ahora,
    catalogo,
    platillos: platillosDelCatalogo(catalogo),
    // Para contestar "¿cuánto cuesta el machacado?" a las nueve de la noche:
    // se puede preguntar por lo que no se puede pedir a esa hora.
    todos: platillosDelCatalogo(catalogoParaPedir(ficha.menus, ficha.zona, ahora, { todas: true })),
    cliente: chat.nombre ?? entrada.nombre ?? null,
    nuevo: Boolean(chat.nuevo),
  };

  let r;
  if (entrada.tipo === "opcion") r = porOpcion(ctx, entrada.opcion);
  else if (entrada.tipo === "ubicacion") r = porUbicacion(ctx);
  else if (entrada.tipo === "texto") r = porTexto(ctx);
  else r = mensajeDeOpciones(ctx, "Por ahora solo leo mensajes de texto. ¿En qué te ayudo?");

  // Quien escribe por primera vez recibe un saludo antes de la respuesta.
  let mensajes = r.mensajes;
  if (ctx.nuevo && !r.saludado && mensajes[0]?.texto) {
    const hola = `¡Hola! Soy el asistente de ${ficha.nombre}.`;
    mensajes = [{ ...mensajes[0], texto: `${hola}\n\n${mensajes[0].texto}` }, ...mensajes.slice(1)];
  }

  const sello = { actualizado: ahora.toISOString() };
  return {
    mensajes,
    estado: { ...r.estado, ...sello },
    ...(r.estadoSiFalla ? { estadoSiFalla: { ...r.estadoSiFalla, ...sello } } : {}),
    ...(r.pedido ? { pedido: r.pedido } : {}),
    ...(r.pausar ? { pausar: r.pausar } : {}),
  };
}
