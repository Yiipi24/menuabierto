// Los precios se guardan en centavos enteros: en punto flotante terminan
// mostrando 89.99000001. Aquí está la traducción en los dos sentidos, en un
// solo lugar, porque la usan el panel al capturar y la ficha al mostrar.

// El dueño escribe el precio como lo dice: 89, 89.50, $89.50, 1,250.00.
// Devuelve los centavos, null si no escribió nada (un platillo puede no
// publicar precio) y undefined si lo escrito no es un precio.
export function aCentavos(bruto) {
  const texto = String(bruto ?? "").trim();
  if (!texto) return null;

  const limpiado = texto.replace(/[^0-9.,]/g, "");
  if (!limpiado) return undefined;

  // "1,250.00" usa la coma de millares; "89,50" la usa de decimal. Manda el
  // último separador que aparezca.
  const ultimaComa = limpiado.lastIndexOf(",");
  const ultimoPunto = limpiado.lastIndexOf(".");
  const normalizado =
    ultimaComa > ultimoPunto
      ? limpiado.replace(/\./g, "").replace(",", ".")
      : limpiado.replace(/,/g, "");

  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero < 0) return undefined;
  // Un platillo de más de cien mil pesos es un dedo de más, no un precio.
  if (numero > 100000) return undefined;
  return Math.round(numero * 100);
}

// Para volver a llenar el campo del formulario: 8900 -> "89", 8950 -> "89.50".
export function aTextoDePrecio(centavos) {
  if (centavos == null) return "";
  return centavos % 100 === 0
    ? String(centavos / 100)
    : (centavos / 100).toFixed(2);
}

export function pesos(centavos, moneda = "MXN") {
  if (centavos == null) return null;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  }).format(centavos / 100);
}
