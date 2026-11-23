// Si un menú visible tiene algo que enseñar: uno de archivo, su archivo; uno
// digital, al menos un platillo. Es la misma regla con la que la ficha
// pública esconde los vacíos (`app/_ficha/datos.js`), y la usa el sitemap para
// no anunciar una carta que responde "Menú no encontrado".
export function menuPublicable({ kind, file_path, platillos }) {
  if (kind === "archivo") return Boolean(file_path);
  return Number(platillos) > 0;
}

// Cuántos platillos trae una fila pedida con `menu_items(count)`.
export function platillosDeFila(fila) {
  return Number(fila?.menu_items?.[0]?.count ?? 0);
}

// Las monedas que se saben decir con su nombre. La base guarda el código ISO
// (`menu_items.currency`, 'MXN' por defecto); uno que no esté aquí sale tal
// cual, que también se entiende.
const MONEDAS = {
  MXN: "pesos mexicanos (MXN)",
  USD: "dólares estadounidenses (USD)",
};

/**
 * La leyenda al pie de la carta (#98): en qué moneda están los precios y que
 * son finales. "$145" en México se lee como pesos, pero quien viene de fuera
 * no lo sabe, y la ley pide enseñar el precio total, con impuestos: el panel
 * le pide al dueño capturarlo así, y la leyenda lo dice.
 *
 * Solo cuenta lo que la carta pinta con precio. Una carta de archivo trae sus
 * propios precios dentro del PDF, y una sin precios no tiene nada que aclarar:
 * en los dos casos no hay leyenda.
 */
export function leyendaDePrecios(menus) {
  const monedas = new Set();
  for (const m of menus ?? []) {
    if (m?.kind === "archivo") continue;
    for (const g of m?.grupos ?? []) {
      for (const p of g?.items ?? []) {
        if (p?.price_cents != null) monedas.add(String(p.currency || "MXN").toUpperCase());
      }
    }
  }
  if (!monedas.size) return null;
  const nombres = [...monedas].sort().map((c) => MONEDAS[c] ?? c);
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}` : nombres[0];
  return `Precios en ${lista}, con IVA incluido, como los publica el restaurante.`;
}
