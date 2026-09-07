// Publicar también en las redes del restaurante.
//
// El panel enseña Facebook, Instagram, X y TikTok con un interruptor cada una,
// pero ninguna publicación sale todavía hacia esas plataformas: falta la parte
// de fuera —la app de Meta revisada, el cliente de TikTok, el proyecto de X— y
// hasta que exista no hay forma honesta de mandar nada.
//
// Por eso este módulo declara la integración apagada en un solo sitio en vez de
// dejar interruptores que parecen funcionar. Cuando cada API esté lista, se
// enciende su bandera aquí, se guarda la conexión del dueño y el resto de la
// pantalla —que ya sabe leer los cinco estados— empieza a servir de verdad.

export const REDES_PUBLICACION = [
  { slug: "facebook", nombre: "Facebook", pista: "Página del restaurante" },
  { slug: "instagram", nombre: "Instagram", pista: "Cuenta de empresa" },
  { slug: "x", nombre: "X", pista: "Perfil del restaurante" },
  { slug: "tiktok", nombre: "TikTok", pista: "Cuenta de empresa" },
];

// Los estados reales por los que pasa una red. No hay un sexto que quiera decir
// "hicimos como que sí".
export const ESTADO = {
  SIN_CONECTAR: "sin_conectar",
  CONECTADA: "conectada",
  PUBLICANDO: "publicando",
  PUBLICADO: "publicado",
  ERROR: "error",
};

// Qué integración está viva. Todas apagadas: no existe ni el OAuth ni el
// guardado de credenciales, así que ninguna cuenta puede estar conectada.
export const INTEGRACION_LISTA = {
  facebook: false,
  instagram: false,
  x: false,
  tiktok: false,
};

export function integracionLista(slug) {
  return INTEGRACION_LISTA[slug] === true;
}

// El texto de cada estado, en un solo sitio para que la tarjeta y la lista de
// resultados digan lo mismo.
export function textoDeEstado(estado, nombre) {
  switch (estado) {
    case ESTADO.CONECTADA:
      return "Conectada";
    case ESTADO.PUBLICANDO:
      return "Publicando…";
    case ESTADO.PUBLICADO:
      return "Publicado";
    case ESTADO.ERROR:
      return `No se pudo publicar en ${nombre}`;
    default:
      return "Sin conectar";
  }
}

// Lo que se le dice a quien pulsa "Conectar" mientras la integración no exista.
// Decirlo entero —qué falta y qué pasa mientras tanto— evita que alguien crea
// que su historia salió en Instagram cuando no salió.
export function avisoSinIntegracion(nombre) {
  return `Todavía no podemos conectar ${nombre}: estamos terminando la integración con su API oficial. Mientras tanto, tu contenido se publica en tu ficha de Menú Abierto y no se manda a ${nombre}.`;
}

/**
 * El estado inicial de las cuatro redes para un dueño.
 *
 * Recibe las conexiones guardadas —hoy siempre ninguna— y devuelve una entrada
 * por red. Cuando exista la tabla de conexiones, esta función es el único sitio
 * donde hay que leerla.
 *
 * @param {Array<{provider: string, cuenta?: string}>} conexiones
 */
export function estadoInicialDeRedes(conexiones = []) {
  const porSlug = new Map((conexiones ?? []).map((c) => [c.provider, c]));

  return REDES_PUBLICACION.map((red) => {
    const guardada = integracionLista(red.slug) ? porSlug.get(red.slug) : null;
    return {
      ...red,
      estado: guardada ? ESTADO.CONECTADA : ESTADO.SIN_CONECTAR,
      cuenta: guardada?.cuenta ?? null,
      // El interruptor solo se puede encender si hay algo detrás.
      activa: false,
      mensaje: "",
    };
  });
}
