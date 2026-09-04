// Las metas del comensal. Cada insignia se gana al llegar a un número de
// reseñas escritas, y el número vive aquí, en un solo lugar: lo usan la página
// de insignias, la ficha (para la etiqueta junto al nombre) y el mensaje que
// aparece al guardar una reseña.
//
// El catálogo no está en la base a propósito: la base guarda cuántas reseñas
// lleva cada quien (`profiles.reviews_count`) y las insignias se derivan de ese
// número. Así, renombrar una insignia o mover una meta es cambiar este archivo
// y no una migración con datos que ya se repartieron.
//
// Las metas suben despacio al principio (1, 3, 5) porque el salto difícil es
// escribir la primera; después se separan, para que "Leyenda" siga
// significando algo.
export const INSIGNIAS = [
  {
    slug: "primera",
    nombre: "Primera reseña",
    meta: 1,
    lema: "Rompiste el hielo",
    descripcion:
      "Escribiste tu primera reseña. Alguien va a decidir dónde comer gracias a ella.",
  },
  {
    slug: "catador",
    nombre: "Catador",
    meta: 3,
    lema: "Tres lugares reseñados",
    descripcion: "Ya no fue casualidad: tomaste el hábito de contar cómo te fue.",
  },
  {
    slug: "explorador",
    nombre: "Explorador",
    meta: 5,
    lema: "Cinco lugares reseñados",
    descripcion: "Cinco cocinas distintas con tu opinión encima.",
  },
  {
    slug: "sibarita",
    nombre: "Sibarita",
    meta: 10,
    lema: "Diez lugares reseñados",
    descripcion: "Tus reseñas ya son una guía para quien no sabe dónde comer.",
  },
  {
    slug: "critico",
    nombre: "Crítico",
    meta: 25,
    lema: "Veinticinco lugares reseñados",
    descripcion: "A este paso conoces la ciudad mejor que los buscadores.",
  },
  {
    slug: "embajador",
    nombre: "Embajador",
    meta: 50,
    lema: "Cincuenta lugares reseñados",
    descripcion: "Medio centenar de reseñas. Los restaurantes te deben una comida.",
  },
  {
    slug: "leyenda",
    nombre: "Leyenda",
    meta: 100,
    lema: "Cien lugares reseñados",
    descripcion: "Cien reseñas. Muy poca gente llega hasta aquí.",
  },
];

const POR_SLUG = new Map(INSIGNIAS.map((i) => [i.slug, i]));

export function insigniaPorSlug(slug) {
  return POR_SLUG.get(slug) ?? null;
}

// El conteo llega de la base, es decir, puede ser null (perfil recién creado) o
// cualquier cosa. Se limpia una vez para que nadie más tenga que dudarlo.
export function conteoDe(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function insigniasGanadas(resenas) {
  const total = conteoDe(resenas);
  return INSIGNIAS.filter((i) => total >= i.meta);
}

// La que se enseña junto al nombre: la más alta alcanzada. Enseñar las siete
// en cada reseña sería una fila de medallas donde debería ir un nombre.
export function insigniaActual(resenas) {
  const ganadas = insigniasGanadas(resenas);
  return ganadas.length ? ganadas[ganadas.length - 1] : null;
}

export function siguienteInsignia(resenas) {
  const total = conteoDe(resenas);
  return INSIGNIAS.find((i) => total < i.meta) ?? null;
}

// La insignia que se acaba de ganar es la que tiene esta meta exacta: se
// pregunta después de guardar una reseña, cuando el conteo ya subió.
export function insigniaAlLlegar(resenas) {
  const total = conteoDe(resenas);
  return INSIGNIAS.find((i) => i.meta === total) ?? null;
}

/**
 * El avance hacia la siguiente meta. El porcentaje se mide desde la meta
 * anterior y no desde cero: entre 25 y 50 reseñas, una barra que arranca en
 * cero se ve parada durante veinticuatro reseñas.
 */
export function progresoDe(resenas) {
  const total = conteoDe(resenas);
  const actual = insigniaActual(total);
  const siguiente = siguienteInsignia(total);
  const desde = actual?.meta ?? 0;

  if (!siguiente) {
    return { total, actual, siguiente: null, faltan: 0, porcentaje: 100 };
  }

  const tramo = siguiente.meta - desde;
  const avance = total - desde;
  return {
    total,
    actual,
    siguiente,
    faltan: siguiente.meta - total,
    porcentaje: tramo > 0 ? Math.min(100, Math.round((avance / tramo) * 100)) : 0,
  };
}
