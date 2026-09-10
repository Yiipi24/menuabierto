// Inteligencia de precios: lo que no habla con la base.
//
// La base agrega —medianas por zona y por cocina, con un mínimo de
// restaurantes para no delatar a nadie— y aquí se decide cómo se lee: cuánto
// por encima o por debajo está un precio, cuándo eso merece un aviso, y cómo
// se escribe un rango de precios para un comensal.

import { pesos, aCentavos } from "./precios";

// A partir de qué diferencia el dueño recibe aviso. Un cuarto: por debajo se
// deja dinero en la mesa; por encima, se pierden mesas.
export const UMBRAL_AVISO = 0.25;

export function diferenciaPct(mio, referencia) {
  const a = Number(mio);
  const b = Number(referencia);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round(((a - b) / b) * 100);
}

/**
 * La posición frente a una referencia, en palabras: "12% por encima de tu
 * colonia", y si merece aviso. Sin referencia (menos del mínimo) dice que no
 * hay con qué comparar todavía, que es distinto de "vas bien".
 */
export function posicionFrenteA(mio, referencia, nombre) {
  const pct = diferenciaPct(mio, referencia);
  if (pct === null) {
    return { pct: null, aviso: false, texto: `Todavía no hay suficientes restaurantes en ${nombre} para comparar.` };
  }
  const aviso = Math.abs(pct) / 100 >= UMBRAL_AVISO;
  if (pct === 0) return { pct, aviso, texto: `Igual que la mediana de ${nombre}.` };
  const lado = pct > 0 ? "por encima" : "por debajo";
  return {
    pct,
    aviso,
    texto: `${Math.abs(pct)}% ${lado} de la mediana de ${nombre} (${pesos(referencia)}).`,
  };
}

/**
 * Lo que se le dice al dueño en la tarjeta del tablero, a partir del jsonb de
 * `posicion_de_precio`.
 */
export function leerPosicion(datos) {
  if (!datos || datos.mi_mediana == null) {
    return { lista: false, texto: "Captura precios en tu carta para ver cómo se comparan con tu zona." };
  }
  const zonaNombre = datos.zona?.nombre
    ? `${datos.zona.nivel === "ciudad" ? "" : "la colonia "}${datos.zona.nombre}`
    : "tu zona";
  const zona = posicionFrenteA(datos.mi_mediana, datos.zona?.mediana, zonaNombre);
  const cocina = posicionFrenteA(datos.mi_mediana, datos.cocina?.mediana, `tu cocina en la ciudad`);
  return {
    lista: true,
    miMediana: datos.mi_mediana,
    misPlatillos: datos.mis_platillos,
    zona,
    cocina,
    aviso: zona.aviso || cocina.aviso,
    minimo: datos.minimo ?? 3,
  };
}

// "$80 – $150" a partir de los percentiles de la zona.
export function rangoLegible(p25, p75) {
  if (p25 == null || p75 == null) return null;
  return `${pesos(p25)} – ${pesos(p75)}`;
}

// El tope de precio que escribe el comensal: "30", "$30", "30.50". Vacío es
// sin tope; basura también, para no filtrar por un número inventado.
export function topeEnCentavos(bruto) {
  const c = aCentavos(bruto);
  return c && c > 0 ? c : null;
}
