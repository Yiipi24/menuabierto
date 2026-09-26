// Los pedidos del asistente de WhatsApp: todo lo que no habla con nadie.
//
// Un pedido se arma en el chat —platillo por platillo, desde la carta de la
// ficha o escrito de corrido— y termina como una fila en `orders`. Aquí vive lo
// que decide qué se puede pedir, cómo se lee lo que escribió el cliente, qué se
// guarda y qué se le avisa, para poder probarlo sin red y sin base. Quien habla
// con la base y con Meta está en `app/api/whatsapp/atender.js`.

import { aCentavos, pesos } from "./precios";
import { seSirveAhora } from "./horarios-menu";
import { GRUPO_SUELTOS } from "./menus";
import { ENTREGAS, entregaDe, renglonDePedido } from "./whatsapp";

// Los topes. Veinte renglones es más de lo que pide una mesa de diez, y
// cincuenta de lo mismo ya es un evento, que se habla por teléfono.
export const MAX_LINEAS = 20;
export const MAX_CANTIDAD = 50;
export const MAX_NOTA_PEDIDO = 300;
export const MAX_DIRECCION = 300;
export const MAX_DETALLE = 1000;
export const MAX_NOMBRE = 80;

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

// Por dónde pasa un pedido. Los slugs son los del `check` de `orders.status`,
// y los cambios permitidos, los mismos que deja `cambiar_estado_pedido()`: la
// base es la que manda, y esto solo evita enseñar un botón que va a fallar.
export const ESTADOS_PEDIDO = [
  { slug: "nuevo", nombre: "Nuevo", boton: null },
  { slug: "aceptado", nombre: "En preparación", boton: "Aceptar" },
  { slug: "listo", nombre: "Listo", boton: "Ya está listo" },
  { slug: "entregado", nombre: "Entregado", boton: "Entregado" },
  { slug: "cancelado", nombre: "Cancelado", boton: "Cancelar" },
];

const ESTADO_POR_SLUG = new Map(ESTADOS_PEDIDO.map((e) => [e.slug, e]));

export function estadoDePedido(slug) {
  return ESTADO_POR_SLUG.get(String(slug ?? "")) ?? null;
}

const SIGUIENTES = new Map([
  ["nuevo", ["aceptado", "cancelado"]],
  ["aceptado", ["listo", "cancelado"]],
  ["listo", ["entregado", "cancelado"]],
]);

export function siguientesEstados(slug) {
  return SIGUIENTES.get(String(slug ?? "")) ?? [];
}

// Abierto es todo lo que todavía le toca al restaurante mover.
export function pedidoAbierto(slug) {
  return SIGUIENTES.has(String(slug ?? ""));
}

// Los cerrados se quedan un día a la vista en el panel: el de hace una hora
// todavía se consulta ("¿ya salió el de la casa azul?"); el de ayer ya no es
// trabajo de nadie.
export const HORAS_CERRADOS = 24;

export function cerradosDesde(ahora = Date.now()) {
  return new Date(ahora - HORAS_CERRADOS * 3600 * 1000).toISOString();
}

/**
 * Lo que se le escribe al cliente cuando el dueño mueve su pedido, o `null`
 * cuando no se le escribe nada.
 *
 * "Entregado" no avisa: quien ya tiene la comida en la mano no necesita que se
 * lo digan, y desde octubre de 2026 cada respuesta pasada la milésima del mes
 * se paga. Habla el restaurante, en primera persona, como el resto del chat.
 */
export function avisoDeEstado({ status, codigo, entrega, telefono = null }) {
  if (status === "aceptado") {
    return `Aceptamos tu pedido ${codigo}. Ya lo estamos preparando.`;
  }
  if (status === "listo") {
    if (entrega === "domicilio") return `Tu pedido ${codigo} ya va en camino.`;
    if (entrega === "llevar") return `Tu pedido ${codigo} está listo. Ya puedes pasar por él.`;
    return `Tu pedido ${codigo} está listo.`;
  }
  if (status === "cancelado") {
    return `Lo sentimos: no pudimos tomar tu pedido ${codigo}.${
      telefono ? ` Si tienes dudas, llámanos al ${telefono}.` : ""
    }`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// El código
// ---------------------------------------------------------------------------

// Sin 0, O, 1, I ni L: el código se dice en voz alta en el mostrador y se
// dicta por teléfono, y ahí esas letras se confunden. Cuatro caracteres de
// treinta y uno dan para cientos de miles de pedidos por restaurante; si uno
// se repite, el índice único lo rechaza y se sortea otro.
export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LARGO_CODIGO = 4;

export function codigoDePedido(azar = Math.random) {
  let codigo = "";
  for (let i = 0; i < LARGO_CODIGO; i += 1) {
    const n = Math.floor(azar() * ALFABETO_CODIGO.length);
    codigo += ALFABETO_CODIGO[Math.min(Math.max(n, 0), ALFABETO_CODIGO.length - 1)];
  }
  return codigo;
}

// ---------------------------------------------------------------------------
// Lo que se puede pedir
// ---------------------------------------------------------------------------

/**
 * La carta que se puede pedir ahora mismo, en grupos como los de la ficha.
 *
 * Solo entran las cartas digitales —un PDF no tiene platillos que tocar— que
 * se están sirviendo a esta hora: el desayuno no se pide a las nueve de la
 * noche. Un platillo agotado tampoco entra, igual que en la carta no tiene
 * botón de agregar.
 *
 * Con varias cartas a la vez, el grupo de los sueltos se llama como su carta:
 * dos "Otros platillos" seguidos en una lista no le dicen nada a nadie.
 *
 * Con `todas` entran también las que no se sirven a esta hora: sirve para
 * contestar cuánto cuesta el desayuno a las nueve de la noche, no para
 * pedirlo.
 */
export function catalogoParaPedir(menus, zona, ahora = new Date(), { todas = false } = {}) {
  const cartas = (menus ?? []).filter(
    (m) => m && m.kind !== "archivo" && (todas || seSirveAhora(m, zona, ahora) !== false),
  );
  const varias = cartas.length > 1;
  const grupos = [];

  for (const m of cartas) {
    for (const g of m.grupos ?? []) {
      const platillos = (g.items ?? [])
        .filter((p) => p?.id && p.is_available !== false && String(p.name ?? "").trim())
        .map((p) => ({
          id: p.id,
          nombre: String(p.name).trim(),
          descripcion: String(p.description ?? "").trim() || null,
          precio: p.price_cents ?? null,
          moneda: p.currency || "MXN",
        }));
      if (!platillos.length) continue;
      grupos.push({
        id: String(g.id),
        nombre: g.name === GRUPO_SUELTOS && varias ? m.name : g.name,
        carta: varias ? m.name : null,
        platillos,
      });
    }
  }
  return grupos;
}

// Los platillos del catálogo por id. Un platillo que aparece en dos cartas a
// la vez se queda con la primera, que es la que la ficha enseña primero.
export function platillosDelCatalogo(catalogo) {
  const porId = new Map();
  for (const g of catalogo ?? []) {
    for (const p of g.platillos) {
      if (!porId.has(p.id)) porId.set(p.id, { ...p, grupo: g.id });
    }
  }
  return porId;
}

// ---------------------------------------------------------------------------
// El carrito
// ---------------------------------------------------------------------------

// El carrito vive en el estado del chat como `[{ id, nombre, cantidad }]`: lo
// que el cliente eligió y nada más. El precio se vuelve a leer de la carta
// cada vez que se enseña, así que uno que el dueño cambió a media
// conversación sale ya cambiado en la confirmación. El nombre se guarda solo
// para poder decir cuál se quedó fuera si su carta deja de servirse.
export function agregarAlCarrito(carrito, platillo, cantidad) {
  const lista = Array.isArray(carrito) ? [...carrito] : [];
  const n = Math.floor(Number(cantidad));
  if (!platillo?.id || !Number.isFinite(n) || n < 1) return lista;

  const i = lista.findIndex((l) => l.id === platillo.id);
  if (i >= 0) {
    lista[i] = { ...lista[i], cantidad: Math.min(lista[i].cantidad + n, MAX_CANTIDAD) };
    return lista;
  }
  if (lista.length >= MAX_LINEAS) return lista;
  return [...lista, { id: platillo.id, nombre: platillo.nombre, cantidad: Math.min(n, MAX_CANTIDAD) }];
}

export function quitarDelCarrito(carrito, id) {
  return (Array.isArray(carrito) ? carrito : []).filter((l) => l.id !== id);
}

// Lo que llega de la base es lo que sea que haya en un jsonb: se limpia antes
// de confiar en ello.
export function carritoValido(carrito) {
  if (!Array.isArray(carrito)) return [];
  return carrito
    .filter((l) => l && typeof l.id === "string" && l.id)
    .map((l) => ({
      id: l.id,
      nombre: String(l.nombre ?? "").slice(0, 120),
      cantidad: Math.min(Math.max(Math.floor(Number(l.cantidad)) || 1, 1), MAX_CANTIDAD),
    }))
    .slice(0, MAX_LINEAS);
}

/**
 * El carrito contra la carta de ahora: los renglones que se pueden pedir, con
 * su precio de este momento, y los nombres de los que ya no.
 */
export function lineasDelCarrito(carrito, platillos) {
  const lineas = [];
  const faltan = [];
  for (const l of carritoValido(carrito)) {
    const p = platillos.get(l.id);
    if (!p) {
      faltan.push(l.nombre || "un platillo");
      continue;
    }
    lineas.push({ id: p.id, nombre: p.nombre, cantidad: l.cantidad, precio: p.precio, moneda: p.moneda });
  }
  return { lineas, faltan };
}

export function cuentaDe(lineas) {
  const lista = lineas ?? [];
  const conPrecio = lista.filter((l) => l.precio != null);
  return {
    piezas: lista.reduce((suma, l) => suma + l.cantidad, 0),
    total: conPrecio.reduce((suma, l) => suma + Number(l.precio) * l.cantidad, 0),
    // El mismo criterio que la barra de la carta: sin el precio de todo, la
    // suma de lo que sí lo trae es una cuenta más barata que la de verdad.
    completo: lista.length > 0 && conPrecio.length === lista.length,
    alguno: conPrecio.length > 0,
    moneda: lista.find((l) => l.moneda)?.moneda ?? "MXN",
  };
}

/**
 * Los renglones del pedido y su total, como los lee el cliente.
 *
 * El total va como aproximado siempre, igual que en el mensaje de la carta:
 * quien confirma la cuenta y cobra es el restaurante.
 */
export function textoDelPedido(lineas) {
  const cuenta = cuentaDe(lineas);
  const renglones = (lineas ?? []).map((l) => renglonDePedido(l, l.moneda || cuenta.moneda));
  if (cuenta.alguno) {
    renglones.push(
      `Total aproximado: ${pesos(cuenta.total, cuenta.moneda)}${
        cuenta.completo ? "" : " (sin lo que no tiene precio)"
      }`,
    );
  }
  return renglones.join("\n");
}

// ---------------------------------------------------------------------------
// Leer lo que escribió el cliente
// ---------------------------------------------------------------------------

export function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "• 2 × Pastor — $50", tal como lo escribe `renglonDePedido`: con su viñeta y
// su signo de por, que nadie teclea a mano. Una lista escrita a mano ("- 2x
// tacos") no pasa por aquí sino por `interpretarPedido`, que no exige el
// nombre exacto. El importe se separa solo con la raya larga que pone la
// carta: "Tacos - orden" es un nombre de platillo posible.
const RENGLON_DE_LA_CARTA = /^\s*•\s*(\d{1,3})\s*×\s*(.+?)(?:\s+[—–]\s+([^—–]*\d[^—–]*))?\s*$/;

/**
 * El pedido que armó la carta de la ficha, de vuelta a platillos.
 *
 * Quien toca "Enviar por WhatsApp" en la carta manda un mensaje ya escrito, y
 * si el número del restaurante es el del asistente, ese mensaje llega aquí.
 * Cada renglón trae la cantidad, el nombre y el importe; el nombre se busca en
 * la carta de ahora, y cuando dos platillos se llaman igual —el "Especial" de
 * la comida y el de la cena— decide el precio. Lo que no se encuentra vuelve
 * con su cantidad, para intentarlo como texto libre. Devuelve `null` cuando el
 * mensaje no trae renglones de pedido.
 */
export function leerMensajeDeLaCarta(texto, platillos) {
  const renglones = String(texto ?? "").split(/\r?\n/);
  const leidos = [];
  for (const r of renglones) {
    const m = RENGLON_DE_LA_CARTA.exec(r);
    if (!m) continue;
    const cantidad = Number(m[1]);
    if (cantidad < 1) continue;
    leidos.push({ cantidad, nombre: m[2].trim(), importe: m[3] ? aCentavos(m[3]) : null });
  }
  if (!leidos.length) return null;

  const porNombre = new Map();
  for (const p of platillos.values()) {
    const llave = normalizar(p.nombre);
    if (!porNombre.has(llave)) porNombre.set(llave, []);
    porNombre.get(llave).push(p);
  }

  const lineas = [];
  const sinEncontrar = [];
  for (const l of leidos) {
    const candidatos = porNombre.get(normalizar(l.nombre)) ?? [];
    const unitario = l.importe != null ? Math.round(l.importe / l.cantidad) : null;
    const elegido = candidatos.find((p) => unitario != null && p.precio === unitario) ?? candidatos[0];
    if (elegido) {
      lineas.push({ id: elegido.id, nombre: elegido.nombre, cantidad: Math.min(l.cantidad, MAX_CANTIDAD) });
    } else {
      sinEncontrar.push({ nombre: l.nombre, cantidad: Math.min(l.cantidad, MAX_CANTIDAD) });
    }
  }

  // La carta también escribe cómo lo quieren, con la misma línea de ENTREGAS.
  const entrega =
    ENTREGAS.find((e) => renglones.some((r) => normalizar(r) === normalizar(e.linea)))?.slug ?? null;

  return { lineas, sinEncontrar, entrega };
}

// Las cantidades dichas con palabras. "Media docena" se atiende aparte porque
// son dos palabras.
export const CUANTOS = new Map([
  ["un", 1],
  ["una", 1],
  ["uno", 1],
  ["dos", 2],
  ["tres", 3],
  ["cuatro", 4],
  ["cinco", 5],
  ["seis", 6],
  ["siete", 7],
  ["ocho", 8],
  ["nueve", 9],
  ["diez", 10],
  ["once", 11],
  ["doce", 12],
  ["docena", 12],
]);

// Lo que rodea al pedido y no es un platillo: "quiero", "me das", "porfa",
// "¿tienen...?". Se quita de lo que escribió el cliente y también del nombre
// de cada platillo, así que los dos lados se comparan con la misma regla.
const RELLENO = new Set(
  (
    "quiero quisiera queria quiere queremos pedir pido pedido pedimos ordenar ordeno orden ordenes hacer " +
    "me te nos das da dan regalas regala regalame mandas manda mandame traes trae traen traeme dame damelo " +
    "agrega agregale agregame agregar anade anadele anademe pon ponle ponme suma sumale porfis plis please " +
    "porfa porfavor favor gracias hola buenas buenos tardes noches dias que tal oye " +
    "para llevar domicilio aqui comer tambien mas otra otro otros otras " +
    "tienen tienes hay venden vendes manejan cuanto cuesta cuestan precio vale valen cual cuales " +
    "pieza piezas pz pzs pza porcion porciones"
  ).split(" "),
);

// Las que no distinguen un platillo de otro.
const VACIAS = new Set(
  "de del la el lo los las al a en y e o con sin por un una unos unas mi su x".split(" "),
);

function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previa[0];
    previa[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const arriba = previa[j];
      previa[j] = Math.min(
        previa[j] + 1,
        previa[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = arriba;
    }
  }
  return previa[b.length];
}

// Qué tanto se parecen dos palabras. El plural se resuelve por prefijo
// ("taco" y "tacos", "pastel" y "pasteles") en vez de con reglas de
// gramática, y las faltas de dedo con una letra de diferencia ("tronpo").
function parecido(a, b) {
  if (a === b) return 1;
  const corto = Math.min(a.length, b.length);
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return 0;
  if (corto >= 4 && (a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2) {
    return 0.9;
  }
  if (corto >= 5 && distancia(a, b) <= 1) return 0.8;
  if (corto >= 8 && distancia(a, b) <= 2) return 0.7;
  return 0;
}

function palabrasDe(texto) {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p && !RELLENO.has(p) && !VACIAS.has(p));
}

function puntaje(consulta, platillo) {
  let suma = 0;
  const usadas = new Set();
  for (const q of consulta) {
    let mejor = 0;
    let cual = -1;
    platillo.forEach((t, i) => {
      const s = parecido(q, t);
      if (s > mejor) {
        mejor = s;
        cual = i;
      }
    });
    suma += mejor;
    if (cual >= 0) usadas.add(cual);
  }
  return {
    // Cuánto de lo que escribió se explica con este platillo...
    cobertura: consulta.length ? suma / consulta.length : 0,
    // ...y cuánto del nombre del platillo aparece en lo que escribió.
    precision: platillo.length ? usadas.size / platillo.length : 0,
  };
}

// Los platillos que pueden ser lo que el cliente escribió, del más al menos
// parecido. Entra el que explica casi todo lo escrito ("coca" es la
// Coca-Cola) o el que aparece completo aunque sobren palabras ("tacos de
// pastor bien doraditos").
function candidatosPara(consulta, indice) {
  return indice
    .map((p) => ({ p, ...puntaje(consulta, p.palabras) }))
    .filter((c) => c.cobertura >= 0.75 || (c.precision === 1 && c.cobertura >= 0.4))
    .map((c) => ({ ...c, valor: c.cobertura + c.precision }))
    .sort((a, b) => b.valor - a.valor);
}

// Uno gana si le saca ventaja clara al segundo. Si no, hay que preguntar, y
// las opciones van en el orden de la carta: entre dos que empatan, el puntaje
// fino es ruido y el orden del dueño no.
const VENTAJA = 0.25;
const MAX_CANDIDATOS = 9;

function decidir(candidatos) {
  if (!candidatos.length) return null;
  const [primero, segundo] = candidatos;
  if (!segundo || primero.valor - segundo.valor >= VENTAJA) return { claro: primero.p };
  return {
    dudas: candidatos
      .filter((c) => c.valor > primero.valor - VENTAJA)
      .slice(0, MAX_CANDIDATOS)
      .sort((a, b) => a.p.orden - b.p.orden)
      .map((c) => c.p),
  };
}

// Minúsculas y sin signos, pero con sus acentos: es lo que se le repite al
// cliente cuando algo no se encontró, y "órdenes de pozole" se lee mejor que
// "ordenes de pozole".
function suave(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Un pedido escrito de corrido se parte en trozos: por renglón, por coma, y
// por "y" cuando lo que sigue es una cantidad ("2 de pastor y una horchata").
// Sin cantidad detrás, la "y" es parte del nombre: "papa y chorizo".
const Y_CON_CANTIDAD = new RegExp(
  `\\s(?:y|e)\\s(?=(?:\\d{1,2}x?|media|${[...CUANTOS.keys()].join("|")})\\b)`,
);

function trozosDe(texto) {
  return String(texto ?? "")
    .split(/[\n,;+]+/)
    .flatMap((t) => suave(t).split(Y_CON_CANTIDAD))
    .map((t) => t.trim())
    .filter(Boolean);
}

// Lo que se le repite al cliente de un trozo: lo que escribió sin el "quiero
// 2" del principio ni el "para llevar, porfa" del final.
const ARRANQUE = new Set(
  (
    "quiero quisiera queria quiere queremos pido pedimos me te nos das da dan regalas regala regalame " +
    "mandas manda mandame traes trae traen traeme dame damelo agrega agregale agregame agregar anade anadele anademe " +
    "pon ponle ponme suma sumale porfa porfis plis porfavor favor hola buenas buenos tardes noches dias oye tambien y e media"
  ).split(" "),
);

function loDicho(pares) {
  let i = 0;
  let j = pares.length;
  const esCantidad = (n) => /^\d{1,2}x?$|^x\d{1,2}$/.test(n) || CUANTOS.has(n);
  while (i < j && (ARRANQUE.has(pares[i].n) || esCantidad(pares[i].n) || VACIAS.has(pares[i].n))) i += 1;
  while (j > i && (RELLENO.has(pares[j - 1].n) || VACIAS.has(pares[j - 1].n) || esCantidad(pares[j - 1].n))) j -= 1;
  return pares
    .slice(i, j)
    .map((p) => p.s)
    .join(" ");
}

function cantidadDe(palabras) {
  const lista = [...palabras];
  let cantidad = null;
  const primera = lista[0] ?? "";

  const conX = /^(\d{1,2})x$|^x(\d{1,2})$/.exec(primera);
  if (/^\d{1,2}$/.test(primera)) {
    cantidad = Number(primera);
    lista.shift();
  } else if (conX) {
    cantidad = Number(conX[1] ?? conX[2]);
    lista.shift();
  } else if (primera === "media" && lista[1] === "docena") {
    cantidad = 6;
    lista.splice(0, 2);
  } else if (CUANTOS.has(primera)) {
    cantidad = CUANTOS.get(primera);
    lista.shift();
  } else {
    // "tacos x3" o "pastor 2x": la cantidad al final.
    const ultima = /^x(\d{1,2})$|^(\d{1,2})x$/.exec(lista[lista.length - 1] ?? "");
    if (ultima) {
      cantidad = Number(ultima[1] ?? ultima[2]);
      lista.pop();
    }
  }

  const valida = cantidad != null && cantidad >= 1 && cantidad <= MAX_CANTIDAD;
  return { cantidad: valida ? cantidad : 1, explicita: valida, resto: lista };
}

// Cómo lo quiere, si lo dijo: "para llevar", "a domicilio", "para comer aquí".
export function entregaEnTexto(texto) {
  const t = ` ${normalizar(texto)} `;
  if (/ para llevar /.test(t)) return "llevar";
  if (/ (a|al|para|por) domicilio | envio | enviar | envian | me lo (traen|mandan|llevan) /.test(t)) {
    return "domicilio";
  }
  if (/ (comer|consumir) (aqui|ahi|alla|en el (local|lugar|restaurante)) | para aqui /.test(t)) {
    return "sitio";
  }
  return null;
}

/**
 * Un pedido escrito de corrido, contra la carta: "quiero 2 tacos de trompo y
 * una coca".
 *
 * Devuelve los platillos que se entienden sin duda, los trozos que pueden ser
 * varios platillos —para preguntar cuál—, lo que no se encontró y si el
 * cliente dijo alguna cantidad, que es la mejor señal de que está pidiendo y
 * no preguntando. Nada de esto se guarda sin que el cliente lo vea y lo
 * confirme: equivocarse aquí cuesta una pregunta, no un pedido.
 */
export function interpretarPedido(texto, platillos) {
  const indice = [...platillos.values()]
    .map((p, orden) => ({ ...p, orden, palabras: palabrasDe(p.nombre) }))
    .filter((p) => p.palabras.length);

  const lineas = [];
  const dudas = [];
  const sinEncontrar = [];
  let conCantidad = false;
  let anterior = null;

  for (const trozo of trozosDe(texto)) {
    const pares = trozo
      .split(" ")
      .map((s) => ({ s, n: normalizar(s) }))
      .filter((p) => p.n);
    const crudas = pares.map((p) => p.n).filter((n) => !RELLENO.has(n));
    const { cantidad, explicita, resto } = cantidadDe(crudas);
    const consulta = resto.filter((p) => !VACIAS.has(p) && !CUANTOS.has(p));
    if (!consulta.length) continue;
    if (explicita) conCantidad = true;
    const dicho = loDicho(pares) || resto.join(" ");

    let decision = decidir(candidatosPara(consulta, indice));
    // "2 de trompo y 1 de pastor": el segundo trozo no repite "tacos". Si
    // quedó en duda, se prueba otra vez con la primera palabra del anterior.
    if (decision?.dudas && anterior && !consulta.includes(anterior)) {
      const conContexto = decidir(candidatosPara([anterior, ...consulta], indice));
      if (conContexto?.claro) decision = conContexto;
    }

    if (decision?.claro) {
      lineas.push({ id: decision.claro.id, nombre: decision.claro.nombre, cantidad });
      anterior = consulta[0];
    } else if (decision?.dudas) {
      dudas.push({
        texto: dicho,
        cantidad,
        candidatos: decision.dudas.map((p) => ({ id: p.id, nombre: p.nombre })),
      });
      anterior = consulta[0];
    } else if (explicita) {
      // Solo se reporta lo que traía cantidad: "2 hamburguesas" es un
      // platillo que no hay; "quiero hacer un pedido" no es ningún platillo.
      sinEncontrar.push(dicho);
    }
  }

  return { lineas, dudas, sinEncontrar, conCantidad, entrega: entregaEnTexto(texto) };
}

// ---------------------------------------------------------------------------
// La fila
// ---------------------------------------------------------------------------

function recortado(valor, tope) {
  const v = String(valor ?? "").trim();
  return v ? v.slice(0, tope) : null;
}

/**
 * La fila de `orders`, lista para insertar. Todo lo que la base va a comprobar
 * se comprueba antes aquí, para que un dato raro no convierta el "Confirmar"
 * del cliente en un error.
 */
export function filaDePedido({
  restauranteId,
  codigo,
  origen,
  cliente,
  entrega,
  direccion,
  ubicacion,
  nota,
  libre,
  lineas,
  clave = null,
}) {
  const cuenta = cuentaDe(lineas);
  const telefono = /^[0-9]{6,20}$/.test(String(cliente?.telefono ?? "")) ? cliente.telefono : null;
  const lat = Number(ubicacion?.lat);
  const lng = Number(ubicacion?.lng);
  const conPunto =
    ubicacion && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  return {
    restaurant_id: restauranteId,
    code: codigo,
    origin: ["chat", "carta", "texto"].includes(origen) ? origen : "chat",
    customer_name: recortado(cliente?.nombre, MAX_NOMBRE),
    customer_phone: telefono,
    customer_user_id: recortado(cliente?.usuario, 140),
    delivery: entregaDe(entrega)?.slug ?? null,
    address: recortado(direccion, MAX_DIRECCION),
    lat: conPunto ? lat : null,
    lng: conPunto ? lng : null,
    notes: recortado(nota, MAX_NOTA_PEDIDO),
    details: recortado(libre, MAX_DETALLE),
    items: (lineas ?? []).slice(0, MAX_LINEAS).map((l) => ({
      menu_item_id: l.id ?? null,
      name: String(l.nombre).slice(0, 120),
      quantity: l.cantidad,
      price_cents: l.precio ?? null,
    })),
    total_cents: cuenta.alguno ? cuenta.total : null,
    currency: cuenta.moneda,
    confirmation_key: recortado(clave, 200),
  };
}

/**
 * Los renglones de un pedido guardado, para pintarlo en el panel: lo que se
 * cotizó entonces, no lo que dice la carta hoy.
 */
export function lineasGuardadas(items) {
  return (Array.isArray(items) ? items : [])
    .filter((i) => i && i.name)
    .map((i) => ({
      id: i.menu_item_id ?? null,
      nombre: String(i.name),
      cantidad: Number(i.quantity) || 1,
      precio: i.price_cents ?? null,
    }));
}
