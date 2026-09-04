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
