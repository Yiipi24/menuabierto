// Los datos de quien responde por el sitio ante la ley, en un solo lugar: el
// aviso de privacidad, los términos y el aviso corto de cada formulario los
// leen de aquí. La LFPDPPP pide que el aviso diga quién es el responsable y su
// domicilio; mientras eso no esté, las páginas lo enseñan como pendiente en vez
// de inventarlo.

import { CORREO_DE_SOPORTE } from "./soporte";

export const RESPONSABLE = {
  // Nombre de la persona física o razón social de la persona moral.
  nombre: null,
  // Calle, número, colonia, código postal, ciudad y estado.
  domicilio: null,
  // La ciudad cuyos tribunales resuelven una controversia (términos).
  ciudadTribunales: null,
  marca: "Menú Abierto",
  // El mismo buzón que la ayuda (`lib/soporte.js`): uno solo para todo.
  correo: CORREO_DE_SOPORTE,
};

// La fecha que se enseña como "última actualización". Se cambia cada vez que
// cambia el texto de cualquiera de los dos documentos.
export const ACTUALIZADO = "2026-11-19";

export function fechaLegible(iso = ACTUALIZADO) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

// Lo que falta para que el aviso cumpla. Vacío cuando ya está todo.
export function datosPendientes(responsable = RESPONSABLE) {
  const faltan = [];
  if (!responsable.nombre) faltan.push("nombre o razón social del responsable");
  if (!responsable.domicilio) faltan.push("domicilio del responsable");
  if (!responsable.ciudadTribunales) faltan.push("ciudad de los tribunales");
  return faltan;
}

// Quién es el responsable, en una línea: el nombre legal con la marca, o solo
// la marca mientras falta el nombre.
export function quienResponde(responsable = RESPONSABLE) {
  return responsable.nombre
    ? `${responsable.nombre} (${responsable.marca})`
    : responsable.marca;
}
