// Los planes viven aquí y no en la página que los pinta porque tres lugares
// necesitan el mismo dato: la página de planes, la sección de menús (para
// decir "3 de 5") y el aviso cuando el cupo se llena.
//
// Los números tienen que coincidir con `public.menus_incluidos` en la base.
// El límite de verdad lo pone la base; esto solo lo cuenta antes de tiempo
// para no ofrecer un botón que va a fallar.
export const PLANES = [
  {
    slug: "basico",
    nombre: "Básico",
    precio: "Gratis",
    detalle: "para siempre",
    menus: 5,
    platillos: 3,
    incluye: [
      "Perfil del restaurante con ubicación y horarios",
      "Hasta 5 menús: la carta, bebidas, el menú del día",
      "Plantillas de menú para elegir cómo se ve",
      "Sube tu propio menú en PDF o foto",
      "Foto de la fachada y hasta 3 fotos de platillos",
      "Aparece en las búsquedas de tu zona",
    ],
  },
  {
    slug: "plus",
    nombre: "Plus",
    precio: "Mensual",
    detalle: "precio al lanzamiento",
    menus: 10,
    platillos: 8,
    incluye: [
      "Todo lo del plan Básico",
      "Hasta 10 menús",
      "Promociones y menú del día destacados",
      "Hasta 8 fotos de platillos",
    ],
  },
  {
    slug: "premium",
    nombre: "Premium",
    precio: "Mensual",
    detalle: "precio al lanzamiento",
    destacado: true,
    menus: 30,
    platillos: 20,
    incluye: [
      "Todo lo del plan Plus",
      "Hasta 30 menús: uno por temporada, por sucursal o por turno",
      "Posición destacada en tu zona y tu categoría",
      "Hasta 20 fotos de platillos",
      "Video del local",
      "Estadísticas de visitas y búsquedas",
    ],
  },
];

const PORS_SLUG = new Map(PLANES.map((p) => [p.slug, p]));

// Un plan de paga vencido es un plan básico. Se decide aquí y en la base con
// la misma regla: si no, dejar de pagar conservaría los treinta menús.
export function planVigente(restaurante) {
  const plan = restaurante?.plan ?? "basico";
  if (plan === "basico") return "basico";
  const hasta = restaurante?.premium_until;
  if (hasta && new Date(hasta).getTime() <= Date.now()) return "basico";
  return PORS_SLUG.has(plan) ? plan : "basico";
}

export function plan(restaurante) {
  return PORS_SLUG.get(planVigente(restaurante)) ?? PLANES[0];
}

export function menusIncluidos(restaurante) {
  return plan(restaurante).menus;
}

// La fachada es una sola en todos los planes: es la foto del directorio y una
// segunda no tendría dónde salir. Lo que crece con el plan son los platillos.
export const FOTOS_FACHADA = 1;

export function fotosPlatillosIncluidas(restaurante) {
  return plan(restaurante).platillos;
}

export function nombreDelPlan(restaurante) {
  return plan(restaurante).nombre;
}
