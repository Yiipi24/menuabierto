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
  {
    // El plan de arriba: Premium más el asistente de WhatsApp que toma
    // pedidos. El asistente es solo de este plan; los demás conservan el
    // botón "Pedir por WhatsApp", que deja el mensaje en el chat del local.
    // Lo que se lista aquí ya existe: la página no promete lo que no hace.
    slug: "pedidos",
    nombre: "Pedidos",
    precio: "Mensual",
    detalle: "precio al lanzamiento",
    menus: 100,
    platillos: 20,
    incluye: [
      "Todo lo del plan Premium",
      "100 menús y 200 lecturas de carta por foto al mes",
      "Asistente de WhatsApp que contesta solo: horario, menú, dirección y precios",
      "Lee tu menú de aquí: si cambias algo, el asistente ya lo sabe",
      "Toma pedidos por WhatsApp y te llegan al panel, sin comisión",
      "Le avisa a tu cliente cuando su pedido está aceptado y listo",
      "Alta asistida: subimos tu menú y conectamos tu WhatsApp",
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

// Los planes van de menos a más, en el orden de `PLANES`. Pagando por
// adelantado se puede quedar en el mismo plan o subir; bajar a medio periodo
// no se ofrece: lo que queda del plan vigente se convierte en días del nuevo
// al subir (`registrar_pago_por_adelantado`), y nadie paga para tener menos.
export function ordenDePlan(slug) {
  return PLANES.findIndex((p) => p.slug === slug);
}

export function subeOMantiene(vigente, nuevo) {
  const desde = ordenDePlan(vigente);
  const hasta = ordenDePlan(nuevo);
  return hasta > 0 && hasta >= Math.max(desde, 0);
}

// Pedidos incluye todo lo de Premium. Lo que antes preguntaba "¿es
// Premium?" pregunta esto, para que el plan de arriba no pierda nada.
export function premiumIncluido(restaurante) {
  return ["premium", "pedidos"].includes(planVigente(restaurante));
}

// El asistente de WhatsApp —contestar y tomar pedidos— es solo del plan
// Pedidos vigente. Con el plan vencido, su número se trata como pausado.
export function asistenteIncluido(restaurante) {
  return planVigente(restaurante) === "pedidos";
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
