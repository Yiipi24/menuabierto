// La verificación automática de un reclamo.
//
// Revisar cada solicitud a mano no escala con miles de fichas sembradas, y hay
// una prueba que no necesita a nadie: si el restaurante registró su sitio
// (`tacoselgordo.mx`) y quien reclama entra con un correo de ese dominio
// (`pedro@tacoselgordo.mx`), el correo lo confirmó Supabase al abrir la cuenta
// y el dominio lo confirmó el DENUE al registrar el negocio. Lo demás sigue
// yendo a revisión.
//
// Los correos de proveedores públicos nunca cuentan: cualquiera abre uno.

const PUBLICOS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "yahoo.com.mx",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "prodigy.net.mx",
]);

// "https://www.tacoselgordo.mx/menu" -> "tacoselgordo.mx"
export function dominioDeSitio(url) {
  const texto = String(url ?? "").trim();
  if (!texto) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`).hostname.toLowerCase();
    const sinWww = host.replace(/^www\./, "");
    return sinWww.includes(".") ? sinWww : null;
  } catch {
    return null;
  }
}

export function dominioDeCorreo(correo) {
  const texto = String(correo ?? "").trim().toLowerCase();
  const arroba = texto.lastIndexOf("@");
  if (arroba < 1 || arroba === texto.length - 1) return null;
  return texto.slice(arroba + 1);
}

/**
 * Si el correo de quien reclama demuestra que el restaurante es suyo.
 * El dominio del correo tiene que ser el del sitio, o un subdominio suyo
 * (`reservas.tacoselgordo.mx`), y no puede ser un proveedor público.
 */
export function correoDemuestraElSitio(correo, sitio) {
  const dominioCorreo = dominioDeCorreo(correo);
  const dominioSitio = dominioDeSitio(sitio);
  if (!dominioCorreo || !dominioSitio) return false;
  if (PUBLICOS.has(dominioCorreo) || PUBLICOS.has(dominioSitio)) return false;
  return dominioCorreo === dominioSitio || dominioCorreo.endsWith(`.${dominioSitio}`);
}
