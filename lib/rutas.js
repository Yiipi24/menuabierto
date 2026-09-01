// Un `next` con host ajeno convertiría el inicio de sesión en un puente hacia
// sitios de phishing con la marca de Menú Abierto, así que solo se aceptan
// rutas internas. `//otro.com` empieza con barra y es absoluta: por eso no
// basta con mirar el primer carácter.
export function rutaInterna(valor, porDefecto = "/panel") {
  const v = String(valor ?? "");
  return v.startsWith("/") && !v.startsWith("//") ? v : porDefecto;
}
