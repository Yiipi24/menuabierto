// Leer una carta desde una foto: la parte que no habla con nadie.
//
// El modelo de visión devuelve secciones, platillos y precios en un JSON con
// forma fija; aquí está esa forma, la limpieza de lo que devuelve, el cupo
// mensual por plan y la lectura de lo que el dueño corrigió en la pantalla de
// revisión. `lib/vision.js` es el que llama a la API; esto se puede probar sin
// llave y sin red.

import { aCentavos } from "./precios";
import { planVigente } from "./planes";

// Cuántas lecturas al mes incluye cada plan. Cada una cuesta dinero de verdad
// —una foto de una carta son varios miles de tokens de entrada—, así que el
// plan gratis alcanza para cargar la carta y corregirla, no para usarlo de OCR.
export const LECTURAS_POR_MES = { basico: 3, plus: 15, premium: 50 };

export function lecturasIncluidas(restaurante) {
  return LECTURAS_POR_MES[planVigente(restaurante)] ?? LECTURAS_POR_MES.basico;
}

// Lo que se le manda al modelo. AVIF no está en la lista de la API, así que
// una foto AVIF se rechaza antes de gastar la petición.
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const TIPO_PDF = "application/pdf";

export function tipoDeEntrada(mime) {
  if (TIPOS_IMAGEN.includes(mime)) return "image";
  if (mime === TIPO_PDF) return "document";
  return null;
}

// Topes de lo que se acepta del modelo: una carta de verdad no pasa de esto,
// y lo que pase es un modelo que se fue por las ramas.
export const MAX_SECCIONES = 40;
export const MAX_PLATILLOS = 400;
export const MAX_NOMBRE = 120;
export const MAX_SECCION = 60;
export const MAX_DESCRIPCION = 300;

/**
 * El esquema JSON estricto que la API obliga a cumplir. Los precios viajan
 * como texto tal como están en la carta ("89", "89.50", "1,250") y se
 * convierten aquí con `aCentavos`, que ya sabe leer las tres formas: un número
 * en el esquema obligaría al modelo a decidir si "1,250" es mil doscientos
 * cincuenta o uno punto veinticinco.
 */
export const ESQUEMA_CARTA = {
  type: "object",
  additionalProperties: false,
  required: ["legible", "motivo", "moneda", "secciones"],
  properties: {
    legible: {
      type: "boolean",
      description:
        "true si la imagen es una carta o menú de restaurante y se alcanza a leer. false si está borrosa, cortada, no es un menú o no se distinguen los platillos.",
    },
    motivo: {
      type: ["string", "null"],
      description: "Si no es legible, por qué, en una frase en español. Si es legible, null.",
    },
    moneda: {
      type: "string",
      description: "Código ISO de la moneda de los precios, MXN si no se indica otra.",
    },
    secciones: {
      type: "array",
      description:
        "Las secciones de la carta en el orden en que aparecen. Si la carta no tiene secciones, una sola sección llamada 'Carta'.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nombre", "platillos"],
        properties: {
          nombre: { type: "string", description: "El nombre de la sección tal como está escrito." },
          platillos: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["nombre", "descripcion", "precio"],
              properties: {
                nombre: { type: "string", description: "El nombre del platillo tal como está escrito, sin el precio." },
                descripcion: {
                  type: ["string", "null"],
                  description:
                    "La descripción o los ingredientes si la carta los trae; null si no. Si el platillo tiene varios precios (orden y media orden, tamaños), aquí van los demás con su nombre.",
                },
                precio: {
                  type: ["string", "null"],
                  description:
                    "El precio como está escrito, solo la cifra: '89', '89.50', '1,250'. Con varios precios, el más bajo. null si no tiene precio o no se lee.",
                },
              },
            },
          },
        },
      },
    },
  },
};

export const INSTRUCCIONES = `Eres el asistente de captura de Menú Abierto, un directorio de restaurantes en México. Recibes la foto o el PDF de la carta de un restaurante y devuelves sus secciones, platillos, descripciones y precios con la forma exacta que se te pide.

Reglas:
- Transcribe lo que está escrito. No inventes platillos, descripciones ni precios que no se lean; si un precio no se distingue, déjalo en null.
- Respeta el orden de la carta y sus secciones. Si no hay secciones, usa una sola llamada "Carta".
- Los nombres van con mayúsculas y minúsculas normales, aunque la carta esté toda en mayúsculas. Corrige solo la ortografía evidente, no el nombre.
- Un platillo con varios precios (orden y media orden, chico y grande) lleva el más bajo en "precio" y los demás, con su nombre, en "descripcion".
- Ignora teléfonos, direcciones, redes sociales, lemas y textos legales: no son platillos.
- Si la imagen no es una carta, está demasiado borrosa o cortada para leer los platillos, responde legible=false con el motivo y sin secciones. Es mejor decir que no se lee que adivinar.`;

function texto(valor, max) {
  const limpio = String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return limpio ? limpio.slice(0, max) : "";
}

/**
 * Lo que devolvió el modelo, ya limpio: sin secciones vacías, sin platillos
 * sin nombre, con los precios en centavos y todo recortado a sus topes. Es lo
 * que se guarda y lo que la pantalla de revisión enseña.
 */
export function normalizarExtraccion(crudo) {
  if (!crudo || typeof crudo !== "object") {
    return { legible: false, motivo: "El modelo no devolvió nada que se pudiera leer.", moneda: "MXN", secciones: [] };
  }

  const legible = crudo.legible !== false;
  const secciones = [];
  let platillos = 0;

  for (const s of Array.isArray(crudo.secciones) ? crudo.secciones : []) {
    if (secciones.length >= MAX_SECCIONES) break;
    const items = [];
    for (const p of Array.isArray(s?.platillos) ? s.platillos : []) {
      if (platillos >= MAX_PLATILLOS) break;
      const nombre = texto(p?.nombre, MAX_NOMBRE);
      if (!nombre) continue;
      const precioTexto = texto(p?.precio, 20);
      const centavos = precioTexto ? aCentavos(precioTexto) : null;
      items.push({
        nombre,
        descripcion: texto(p?.descripcion, MAX_DESCRIPCION) || null,
        // undefined es "no se entendió el precio": se enseña vacío y el dueño
        // decide. Nunca se inventa un cero.
        precio: centavos === undefined ? null : centavos,
        precioTexto: precioTexto || null,
        dudoso: Boolean(precioTexto) && centavos === undefined,
      });
      platillos += 1;
    }
    if (!items.length) continue;
    secciones.push({ nombre: texto(s?.nombre, MAX_SECCION) || "Carta", platillos: items });
  }

  const sinPlatillos = platillos === 0;
  return {
    legible: legible && !sinPlatillos,
    motivo: legible
      ? sinPlatillos
        ? "No se distinguió ningún platillo en la imagen."
        : null
      : texto(crudo.motivo, 200) || "La imagen no se alcanza a leer.",
    moneda: /^[A-Z]{3}$/.test(String(crudo.moneda ?? "")) ? crudo.moneda : "MXN",
    secciones,
  };
}

export function resumenDeExtraccion(extraccion) {
  const secciones = extraccion?.secciones ?? [];
  const platillos = secciones.reduce((n, s) => n + s.platillos.length, 0);
  const conPrecio = secciones.reduce((n, s) => n + s.platillos.filter((p) => p.precio != null).length, 0);
  return { secciones: secciones.length, platillos, conPrecio, sinPrecio: platillos - conPrecio };
}

/**
 * Lo que el dueño mandó desde la pantalla de revisión, ya corregido, listo
 * para insertarse. Devuelve `{ error }` si no hay nada que guardar o algo no
 * tiene forma; los platillos desmarcados se quedan fuera y una sección que
 * queda vacía no se crea.
 */
export function leerRevision(crudo) {
  let datos = crudo;
  if (typeof crudo === "string") {
    try {
      datos = JSON.parse(crudo);
    } catch {
      return { error: "La revisión llegó con mala forma. Recarga la página e inténtalo otra vez." };
    }
  }
  if (!datos || !Array.isArray(datos.secciones)) return { error: "No hay nada que guardar." };

  const secciones = [];
  let total = 0;
  for (const s of datos.secciones.slice(0, MAX_SECCIONES)) {
    const nombre = texto(s?.nombre, MAX_SECCION);
    const platillos = [];
    for (const p of Array.isArray(s?.platillos) ? s.platillos : []) {
      if (p?.incluir === false) continue;
      if (total >= MAX_PLATILLOS) break;
      const nombrePlatillo = texto(p?.nombre, MAX_NOMBRE);
      if (nombrePlatillo.length < 2) continue;
      const centavos = aCentavos(p?.precio);
      if (centavos === undefined) {
        return { error: `El precio de "${nombrePlatillo}" no es un número. Ejemplo: 89 o 89.50.` };
      }
      platillos.push({
        nombre: nombrePlatillo,
        descripcion: texto(p?.descripcion, MAX_DESCRIPCION) || null,
        precio: centavos,
      });
      total += 1;
    }
    if (!platillos.length) continue;
    if (nombre.length < 2) return { error: "Cada sección con platillos necesita nombre." };
    secciones.push({ nombre, platillos });
  }

  if (!total) return { error: "No dejaste ningún platillo marcado. Marca al menos uno o cancela." };
  return { secciones, total };
}
