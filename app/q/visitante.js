import { COOKIE_VISITANTE, DIAS_COOKIE } from "../../lib/eventos";

// La cookie anónima del visitante, la misma que identifica los eventos. Las
// rutas de /q la necesitan para dejar el pase de visita, y como el middleware
// no pasa por aquí, la ponen ellas cuando no viene.
export function visitanteDe(galletas) {
  const guardado = galletas.get(COOKIE_VISITANTE)?.value;
  const nueva = !guardado || guardado.length < 8 || guardado.length > 64;
  return { visitante: nueva ? crypto.randomUUID() : guardado, nueva };
}

export function ponerVisitante(respuesta, visitante) {
  respuesta.cookies.set(COOKIE_VISITANTE, visitante, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS_COOKIE * 24 * 60 * 60,
  });
}
