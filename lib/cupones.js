// Cupones con código.
//
// Una promoción anunciada no se puede medir: el dueño pone "15% de descuento"
// en su ficha y al final del mes no sabe si alguien fue por eso. Con un código
// sí, porque el código se dice en la caja y ahí es donde la promoción deja de
// ser un cartel y se vuelve una venta.
//
// Por eso el cupón se cuenta tres veces y no una:
//
//   vistas  — cuántos lo vieron en la ficha
//   copias  — cuántos se llevaron el código
//   canjes  — cuántos lo dijeron en la caja
//
// Las dos primeras son eventos de la ficha (`coupon_view`, `coupon_copy`); la
// tercera la registra el dueño en el panel y vive en `coupon_redemptions`.
// De vistas a canjes es la conversión, que es todo el punto.

import { pesos, aCentavos, aTextoDePrecio } from "./precios";

export const TIPOS = [
  {
    slug: "porcentaje",
    nombre: "Porcentaje de descuento",
    pista: "15% en toda la cuenta.",
    // Lo que se escribe en el campo y con qué unidad.
    campo: "Porcentaje",
    sufijo: "%",
  },
  {
    slug: "monto",
    nombre: "Monto de descuento",
    pista: "$50 menos en tu consumo.",
    campo: "Monto en pesos",
    sufijo: "",
  },
  {
    slug: "2x1",
    nombre: "2x1",
    pista: "Dos por el precio de uno. No lleva cifra.",
    campo: null,
    sufijo: "",
  },
  {
    slug: "regalo",
    nombre: "Algo de regalo",
    pista: "Un postre, una bebida, una entrada. No lleva cifra.",
    campo: null,
    sufijo: "",
  },
];

export const TIPO_POR_DEFECTO = "porcentaje";

const POR_SLUG = new Map(TIPOS.map((t) => [t.slug, t]));

export function tipoValido(slug) {
  return POR_SLUG.has(slug) ? slug : TIPO_POR_DEFECTO;
}

export function tipoDe(slug) {
  return POR_SLUG.get(tipoValido(slug)) ?? TIPOS[0];
}

// Los tipos que llevan cifra. `2x1` y `regalo` no la llevan, y guardarles un
// cero sería inventar un descuento de cero pesos.
export function llevaCifra(slug) {
  return tipoValido(slug) === "porcentaje" || tipoValido(slug) === "monto";
}

// El código se dice en voz alta en la caja: sin acentos, sin espacios y sin
// signos. Se guarda en mayúsculas porque es como se imprime y como se lee, y
// se compara sin distinguirlas —el índice de la base usa upper()— para que
// quien escriba "verano15" no se quede sin su descuento.
export const MAX_CODIGO = 16;

export function normalizarCodigo(bruto) {
  return String(bruto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_CODIGO);
}

export function codigoValido(codigo) {
  return /^[A-Z0-9]{3,16}$/.test(normalizarCodigo(codigo));
}

/**
 * La cifra del cupón, de texto a lo que guarda la base.
 *
 * Devuelve `null` cuando el tipo no lleva cifra, y `undefined` cuando lo
 * escrito no sirve: son cosas distintas y quien llama tiene que poder
 * distinguirlas para contestar "escribe el porcentaje" en vez de guardar nada.
 */
export function aValorGuardado(tipo, bruto) {
  if (!llevaCifra(tipo)) return null;

  if (tipo === "porcentaje") {
    const n = Number(String(bruto ?? "").replace(/[^0-9]/g, ""));
    if (!Number.isFinite(n) || n < 1 || n > 100) return undefined;
    return Math.round(n);
  }

  // Un monto es dinero y viaja en centavos, igual que el precio de un
  // platillo: mismo parser para que "$1,250.00" signifique lo mismo aquí.
  const centavos = aCentavos(bruto);
  if (centavos == null || centavos === undefined || centavos <= 0) return undefined;
  return centavos;
}

// Para volver a llenar el formulario con lo que ya estaba guardado.
export function aTextoDeValor(tipo, valor) {
  if (valor == null || !llevaCifra(tipo)) return "";
  return tipo === "porcentaje" ? String(valor) : aTextoDePrecio(valor);
}

/**
 * Cómo se lee el descuento: "15% de descuento", "$50 de descuento", "2x1".
 * Es lo que va en grande en la tarjeta del cupón, en la ficha y en el panel.
 */
export function textoDelDescuento(cupon) {
  const tipo = tipoValido(cupon?.kind);
  if (tipo === "porcentaje") return `${cupon.value_int}% de descuento`;
  if (tipo === "monto") return `${pesos(cupon.value_int)} de descuento`;
  if (tipo === "2x1") return "2x1";
  return "De regalo";
}

/**
 * Si el cupón está vivo ahora mismo. Es la misma regla que la función
 * `coupon_vigente` de la base, que es la que decide quién lo puede leer: las
 * dos tienen que decir lo mismo o el panel enseñaría "vigente" sobre algo que
 * la ficha ya no muestra.
 */
export function estaVigente(cupon, ahora = new Date()) {
  if (!cupon?.is_active) return false;
  const t = ahora.getTime();
  if (cupon.starts_at && new Date(cupon.starts_at).getTime() > t) return false;
  if (cupon.ends_at && new Date(cupon.ends_at).getTime() <= t) return false;
  if (cupon.max_redemptions != null && (cupon.redemptions_count ?? 0) >= cupon.max_redemptions) {
    return false;
  }
  return true;
}

/**
 * El estado del cupón con el nombre que ve el dueño. No basta con "vigente o
 * no": cuando deja de estarlo, lo que necesita saber es por qué —se acabó, se
 * venció, todavía no empieza— para decidir si lo alarga o lo apaga.
 */
export function estadoDeCupon(cupon, ahora = new Date()) {
  const t = ahora.getTime();
  if (!cupon?.is_active) return { slug: "apagado", nombre: "Apagado" };
  if (cupon.starts_at && new Date(cupon.starts_at).getTime() > t) {
    return { slug: "programado", nombre: "Programado" };
  }
  if (cupon.ends_at && new Date(cupon.ends_at).getTime() <= t) {
    return { slug: "vencido", nombre: "Vencido" };
  }
  if (cupon.max_redemptions != null && (cupon.redemptions_count ?? 0) >= cupon.max_redemptions) {
    return { slug: "agotado", nombre: "Agotado" };
  }
  return { slug: "vigente", nombre: "Vigente" };
}

// De vistas a canjes. Sin vistas no hay porcentaje que calcular: cero entre
// cero es "todavía nada", no 0%.
export function conversion(vistas, canjes) {
  if (!vistas) return null;
  return Math.round((canjes / vistas) * 100);
}

/**
 * "Hasta el 30 de septiembre", "Del 1 al 15 de octubre", "Sin fecha de fin".
 * La vigencia se escribe entera en una línea porque en la tarjeta del cupón no
 * caben dos.
 */
export function textoDeVigencia(cupon) {
  const fecha = (valor) =>
    new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" }).format(new Date(valor));

  if (cupon?.starts_at && cupon?.ends_at) {
    return `Del ${fecha(cupon.starts_at)} al ${fecha(cupon.ends_at)}`;
  }
  if (cupon?.ends_at) return `Hasta el ${fecha(cupon.ends_at)}`;
  if (cupon?.starts_at) return `A partir del ${fecha(cupon.starts_at)}`;
  return "Sin fecha de vencimiento";
}
