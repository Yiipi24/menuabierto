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
