// Armar los grupos de una carta —una sección por bloque y, al final, los
// platillos que se quedaron sin sección— lo necesitan dos lados: la página
// pública y la vista previa del panel. Si cada uno tuviera el suyo, la vista
// previa dejaría de parecerse a la carta en cuanto cambiara una de las dos.

export const GRUPO_SUELTOS = "Otros platillos";

// Un platillo sin sección no desaparece: se va a un grupo propio al final. Y
// una sección vacía tampoco se pinta, porque un encabezado sin nada debajo
// solo hace creer que algo falló.
export function agruparPlatillos(secciones, platillos, idDeSueltos = "sueltos") {
  return [
    ...secciones.map((s) => ({
      id: s.id,
      name: s.name,
      items: platillos.filter((p) => p.section_id === s.id),
    })),
    {
      id: idDeSueltos,
      name: GRUPO_SUELTOS,
      items: platillos.filter((p) => !p.section_id),
    },
  ].filter((g) => g.items.length);
}

// La lista de menús de la ficha enseña una línea bajo cada nombre. El dueño
// puede escribirla en el panel, pero mientras no lo haga se arma sola con lo
// que la carta ya tiene dentro: sus secciones, o sus primeros platillos cuando
// no tiene ninguna. "Brisket, Pulled Pork y acompañamientos" lo escribió sin
// saberlo, al nombrar sus secciones, y una ficha nunca se queda sin la línea
// por una casilla que nadie llenó.
const TOPE_RESUMEN = 3;

function enumerar(nombres, sobran) {
  if (!nombres.length) return "";
  const lista = [...nombres];
  if (sobran > 0) lista.push(`${sobran} más`);
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
}

export function descripcionDeMenu(menu) {
  // Lo que el dueño escribió gana siempre. La automática es el valor de
  // fábrica, no la regla.
  const suya = String(menu.description ?? "").trim();
  if (suya) return suya;

  if (menu.kind === "archivo") {
    return menu.fileMime === "application/pdf"
      ? "La carta completa, en PDF"
      : "La carta completa, en una imagen";
  }

  const grupos = menu.grupos ?? [];
  // Con una sola sección, su nombre no describe la carta: describe la carta
  // entera dos veces. Ahí dicen más los platillos.
  const conNombre = grupos.filter((g) => g.name !== GRUPO_SUELTOS);
  const fuente =
    conNombre.length > 1
      ? conNombre.map((g) => g.name)
      : grupos.flatMap((g) => g.items).map((p) => p.name);

  const nombres = fuente.filter(Boolean).slice(0, TOPE_RESUMEN);
  return enumerar(nombres, fuente.length - nombres.length);
}
