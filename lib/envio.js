// El envío a domicilio de un restaurante (#97): cuánto cuesta, hasta dónde
// llega, desde cuánto se acepta un pedido y en cuánto tiempo sale.
//
// Antes todo eso vivía en la "letra chica" (`whatsapp_note`), que el cliente
// leía y el asistente no aplicaba: confirmaba un pedido a siete kilómetros sin
// costo de envío y el dueño tenía que renegociarlo por chat. Aquí están las
// reglas como datos, y las funciones puras que las aplican; el asistente
// (`lib/asistente.js`), el panel y la ficha leen de aquí.
//
// La distancia es en línea recta desde el punto del local, y la calcula la
// base (`distancia_de_entrega`): las coordenadas del restaurante no salen de
// ella. Es la que usan Take App y Fudo para sus zonas por radio; por calle
// siempre es algo más, y por eso las zonas las pone el dueño.

import { aCentavos, pesos } from "./precios";

export const MAX_ZONAS = 3;
export const MAX_KM = 50;
export const MIN_MINUTOS = 5;
export const MAX_MINUTOS = 240;

function centavosValidos(valor, { positivo = false } = {}) {
  const n = Number(valor);
  if (valor == null || valor === "" || !Number.isInteger(n)) return null;
  if (n < 0 || (positivo && n === 0) || n > 10_000_000) return null;
  return n;
}

function minutosValidos(valor) {
  const n = Number(valor);
  if (valor == null || valor === "" || !Number.isInteger(n)) return null;
  return n >= MIN_MINUTOS && n <= MAX_MINUTOS ? n : null;
}

function kmValidos(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 && n <= MAX_KM ? Math.round(n * 10) / 10 : undefined;
}

/**
 * Las zonas tal como las guarda la base (`restaurants.delivery_zones`:
 * `[{ max_km, fee_cents, minutes }]`), limpias y en orden: de la más cercana a
 * la más lejana. Una zona sin `max_km` es "hasta donde sea": solo puede haber
 * una y va al final. Una sola zona sin distancia es un envío fijo.
 */
export function zonasValidas(lista) {
  const zonas = [];
  for (const z of Array.isArray(lista) ? lista : []) {
    const costo = centavosValidos(z?.fee_cents);
    const km = kmValidos(z?.max_km);
    if (costo == null || km === undefined) continue;
    zonas.push({ km, costo, minutos: minutosValidos(z?.minutes) });
  }
  zonas.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  const sinLimite = zonas.findIndex((z) => z.km == null);
  const hasta = sinLimite === -1 ? zonas : zonas.slice(0, sinLimite + 1);
  // Dos zonas con el mismo radio: gana la primera.
  return hasta.filter((z, i) => i === 0 || z.km == null || z.km !== hasta[i - 1].km).slice(0, MAX_ZONAS);
}

/**
 * Las reglas de envío de un restaurante, o `null` si no puso ninguna: entonces
 * todo sigue como antes, sin costo ni mínimo que aplicar.
 */
export function reglasDeEnvio(r) {
  const zonas = zonasValidas(r?.delivery_zones);
  const minimo = centavosValidos(r?.delivery_min_cents, { positivo: true });
  const gratisDesde = centavosValidos(r?.delivery_free_from_cents, { positivo: true });
  const minutosLlevar = minutosValidos(r?.pickup_minutes);
  if (!zonas.length && minimo == null && gratisDesde == null && minutosLlevar == null) return null;
  return {
    zonas,
    minimo,
    // Envío gratis sin ningún costo de envío no significa nada.
    gratisDesde: zonas.some((z) => z.costo > 0) ? gratisDesde : null,
    minutosLlevar,
    conRadio: zonas.some((z) => z.km != null),
    hastaKm: zonas.length && zonas.at(-1).km != null ? zonas.at(-1).km : null,
  };
}

/**
 * Lo que cuesta llevar un pedido, y si se puede.
 *
 * - `subtotal`: lo que suman los platillos, en centavos, o `null` si no se
 *   sabe (un pedido escrito a mano, o con platillos sin precio). Sin él no se
 *   comprueba el mínimo ni se regala el envío.
 * - `distanciaM`: metros en línea recta, o `null` si el cliente escribió la
 *   dirección en vez de mandar su ubicación. Entonces se cobra la zona más
 *   cara, marcado como `estimado`: el restaurante lo confirma con la
 *   dirección, y nunca le sale más caro de lo que se le dijo.
 */
export function cotizarEnvio(reglas, { subtotal = null, distanciaM = null } = {}) {
  const vacia = { zona: null, costo: null, minutos: null, gratis: false, fuera: false, estimado: false, falta: 0 };
  if (!reglas) return vacia;

  const sub = Number.isFinite(subtotal) ? subtotal : null;
  const falta = reglas.minimo != null && sub != null && sub < reglas.minimo ? reglas.minimo - sub : 0;

  let zona = null;
  let estimado = false;
  if (reglas.zonas.length) {
    if (!reglas.conRadio) {
      zona = reglas.zonas[0];
    } else if (!Number.isFinite(distanciaM)) {
      zona = reglas.zonas.reduce((cara, z) => (z.costo >= cara.costo ? z : cara));
      estimado = true;
    } else {
      zona = reglas.zonas.find((z) => z.km == null || distanciaM <= z.km * 1000) ?? null;
    }
  }
  const fuera = reglas.conRadio && Number.isFinite(distanciaM) && !zona;
  const gratis = Boolean(zona && reglas.gratisDesde != null && sub != null && sub >= reglas.gratisDesde);

  return {
    zona,
    costo: zona ? (gratis ? 0 : zona.costo) : null,
    minutos: zona?.minutos ?? null,
    gratis,
    fuera,
    estimado,
    falta,
  };
}

// "800 m", "2.4 km". Con un decimal: en una ciudad, medio kilómetro es una
// diferencia que el cliente reconoce.
export function distanciaLegible(metros) {
  const m = Number(metros);
  if (!Number.isFinite(m) || m < 0) return null;
  if (m < 1000) return `${Math.max(100, Math.round(m / 100) * 100)} m`;
  const km = Math.round(m / 100) / 10;
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

export function kmLegibles(km) {
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

// "unos 35 minutos", "una hora", "1 h 30 min".
export function minutosLegibles(minutos) {
  const n = Number(minutos);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 60) return `unos ${n} minutos`;
  if (n === 60) return "una hora";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} horas`;
}

function enumerar(partes) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/**
 * Las reglas en una o dos oraciones, para la ficha, la carta y la respuesta a
 * "¿tienen servicio a domicilio?". `null` si no hay nada del envío que decir.
 */
export function textoDeEnvio(reglas, moneda = "MXN") {
  if (!reglas) return null;
  const partes = [];
  const { zonas } = reglas;
  if (zonas.length && !reglas.conRadio) {
    partes.push(zonas[0].costo ? `Envío: ${pesos(zonas[0].costo, moneda)}.` : "Envío gratis.");
  } else if (zonas.length) {
    const tramos = zonas.map((z) => {
      const costo = z.costo ? pesos(z.costo, moneda) : "gratis";
      return z.km != null ? `${costo} hasta ${kmLegibles(z.km)}` : `${costo} más lejos`;
    });
    partes.push(`Envío: ${enumerar(tramos)}.`);
  }
  if (reglas.gratisDesde != null) partes.push(`Gratis desde ${pesos(reglas.gratisDesde, moneda)}.`);
  if (reglas.minimo != null) partes.push(`Pedido mínimo a domicilio: ${pesos(reglas.minimo, moneda)}.`);
  return partes.length ? partes.join(" ") : null;
}

/**
 * El renglón del envío en el resumen del pedido: "Envío: $30 (2.4 km)",
 * "Envío: gratis (tu pedido pasa de $400)", o con la aclaración de que se
 * confirma con la dirección. `null` si no hay costo que decir.
 */
export function renglonDeEnvio(cotizacion, { distanciaM = null, reglas = null, moneda = "MXN" } = {}) {
  if (!cotizacion || cotizacion.costo == null) return null;
  if (cotizacion.gratis) {
    return `Envío: gratis (tu pedido pasa de ${pesos(reglas?.gratisDesde, moneda)})`;
  }
  const costo = cotizacion.costo ? pesos(cotizacion.costo, moneda) : "gratis";
  if (cotizacion.estimado) return `Envío: ${costo}. Lo confirmamos con tu dirección.`;
  const lejos = reglas?.conRadio ? distanciaLegible(distanciaM) : null;
  return `Envío: ${costo}${lejos ? ` (${lejos})` : ""}`;
}

// ---------------------------------------------------------------------------
// El formulario del panel
// ---------------------------------------------------------------------------

function pesosDelCampo(formData, nombre) {
  return aCentavos(formData.get(nombre));
}

function enteroDelCampo(formData, nombre) {
  const t = String(formData.get(nombre) ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Las reglas que escribió el dueño, listas para la base, o el primer error
 * que hay que corregir. Los renglones de zona vacíos se ignoran; la zona sin
 * distancia solo puede ser la última ("más lejos", o el envío fijo).
 */
export function leerEnvioDelFormulario(formData) {
  const minimo = pesosDelCampo(formData, "envio_minimo");
  const gratis = pesosDelCampo(formData, "envio_gratis");
  const llevar = enteroDelCampo(formData, "envio_llevar_minutos");
  if (minimo === undefined) return { error: "El pedido mínimo no se entiende. Escríbelo en pesos, como 150." };
  if (gratis === undefined) return { error: "El \"envío gratis desde\" no se entiende. Escríbelo en pesos, como 400." };
  if (llevar === undefined || (llevar != null && minutosValidos(Math.round(llevar)) == null)) {
    return { error: `El tiempo para llevar va de ${MIN_MINUTOS} a ${MAX_MINUTOS} minutos.` };
  }

  const zonas = [];
  for (let i = 0; i < MAX_ZONAS; i += 1) {
    const kmTexto = String(formData.get(`envio_km_${i}`) ?? "").trim();
    const costoTexto = String(formData.get(`envio_costo_${i}`) ?? "").trim();
    const minTexto = String(formData.get(`envio_minutos_${i}`) ?? "").trim();
    if (!kmTexto && !costoTexto && !minTexto) continue;
    const n = zonas.length + 1;

    const costo = aCentavos(costoTexto);
    if (costo == null) return { error: `Falta el costo de envío de la zona ${n}. Si no cobras envío ahí, escribe 0.` };
    if (costo === undefined) return { error: `El costo de envío de la zona ${n} no se entiende. Escríbelo en pesos, como 35.` };

    const km = kmValidos(kmTexto.replace(",", "."));
    if (km === undefined) return { error: `La distancia de la zona ${n} va de 0.1 a ${MAX_KM} km.` };

    const minutos = minTexto ? Number(minTexto) : null;
    if (minTexto && minutosValidos(minutos) == null) {
      return { error: `El tiempo de la zona ${n} va de ${MIN_MINUTOS} a ${MAX_MINUTOS} minutos.` };
    }

    const anterior = zonas.at(-1);
    if (anterior && anterior.max_km == null) {
      return { error: "Solo la última zona puede ir sin distancia: es la de \"más lejos\"." };
    }
    if (anterior && km != null && km <= anterior.max_km) {
      return { error: `Cada zona llega más lejos que la anterior: la zona ${n} tiene que pasar de ${kmLegibles(anterior.max_km)}.` };
    }
    zonas.push({ max_km: km, fee_cents: costo, minutes: minutos });
  }

  return {
    valores: {
      delivery_min_cents: minimo || null,
      delivery_free_from_cents: gratis || null,
      delivery_zones: zonas,
      pickup_minutes: llevar == null ? null : Math.round(llevar),
    },
  };
}

/** Las reglas guardadas, de vuelta en los campos del formulario. */
export function camposDeEnvio(r) {
  const texto = (c) => (c == null ? "" : c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));
  const zonas = Array.isArray(r?.delivery_zones) ? r.delivery_zones.slice(0, MAX_ZONAS) : [];
  return {
    minimo: texto(r?.delivery_min_cents),
    gratis: texto(r?.delivery_free_from_cents),
    llevar: r?.pickup_minutes == null ? "" : String(r.pickup_minutes),
    zonas: Array.from({ length: MAX_ZONAS }, (_, i) => ({
      km: zonas[i]?.max_km == null ? "" : String(zonas[i].max_km),
      costo: zonas[i] ? texto(zonas[i].fee_cents) : "",
      minutos: zonas[i]?.minutes == null ? "" : String(zonas[i].minutes),
    })),
  };
}
