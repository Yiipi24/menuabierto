// Mapa de teselas, calculado a mano.
//
// El proyecto ya usa OpenStreetMap para geocodificar y con su atribución; las
// teselas vienen del mismo sitio. No hace falta Leaflet: el mapa del panel no
// se arrastra ni se acerca, solo enseña de dónde llega la gente. Todo lo que
// hay que resolver es qué teselas pedir y en qué porcentaje de la caja cae
// cada punto, y eso son veinte líneas de Mercator.
//
// El servidor deja la caja armada y el navegador solo pinta imágenes: las
// posiciones van en porcentaje, así que la misma caja sirve en un teléfono y
// en un monitor sin volver a calcular nada.

// Configurable como el geocodificador: la política de OSM pide justamente eso
// si el volumen crece, y su servidor público deja de ser suficiente.
export const TESELAS =
  process.env.NEXT_PUBLIC_TESELAS_URL || "https://tile.openstreetmap.org";

// Los puntos vienen del borde de Vercel y tienen precisión de ciudad. Acercar
// más que esto sería fingir que sabemos la esquina.
const ZOOM_MAX = 11;
const ZOOM_MIN = 2;

// Web Mercator: de grados a coordenada de tesela (con decimales).
function aTesela(lat, lng, z) {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

function valido(p) {
  return (
    Number.isFinite(p?.lat) &&
    Number.isFinite(p?.lng) &&
    Math.abs(p.lat) <= 85 &&
    Math.abs(p.lng) <= 180
  );
}

/**
 * Arma el mapa que necesita la tarjeta de lugares.
 *
 * @param {Array<{lat: number, lng: number}>} puntos lugares con coordenadas
 * @param {{lat: number, lng: number}|null} ficha el propio restaurante
 * @param {{columnas?: number, filas?: number, zoomMax?: number}} rejilla tamaño
 *        en teselas (4x2: una tira ancha, que es la forma que deja la tarjeta)
 *        y hasta dónde se deja acercar. El tablero se queda en 11, que es
 *        precisión de ciudad y es lo que sabe de sus visitas; el mapa de
 *        resultados sí puede acercarse a la calle, porque una ficha publicada
 *        trae su dirección exacta.
 * @returns {{zoom: number, columnas: number, filas: number,
 *            teselas: Array<{clave: string, url: string}>,
 *            puntos: Array<object>, ficha: object|null}|null}
 *          null cuando no hay ni un punto que pintar.
 */
export function planoDeMapa(
  puntos,
  ficha = null,
  { columnas = 4, filas = 2, zoomMax = ZOOM_MAX } = {},
) {
  const conPunto = (puntos ?? []).filter(valido);
  const todos = valido(ficha) ? [...conPunto, ficha] : conPunto;
  if (!todos.length) return null;

  const lado = (z) => 2 ** z;
  const limite = (v, total, z) => Math.max(0, Math.min(lado(z) - total, v));

  // Del más cercano al más lejano: gana el primer zoom en el que todos los
  // puntos caen dentro del margen visible. Se comprueba la posición final y no
  // el tamaño del recorte porque la rejilla empieza en una tesela entera: dos
  // ciudades que "caben" pueden acabar pegadas al borde igual.
  const MARGEN = 12;
  let elegido = null;

  for (let z = Math.min(zoomMax, 19); z >= ZOOM_MIN && !elegido; z -= 1) {
    const t = todos.map((p) => aTesela(p.lat, p.lng, z));
    const centroX = (Math.max(...t.map((p) => p.x)) + Math.min(...t.map((p) => p.x))) / 2;
    const centroY = (Math.max(...t.map((p) => p.y)) + Math.min(...t.map((p) => p.y))) / 2;
    const x0 = limite(Math.floor(centroX - columnas / 2), columnas, z);
    const y0 = limite(Math.floor(centroY - filas / 2), filas, z);

    const dentro = t.every((c) => {
      const izquierda = ((c.x - x0) / columnas) * 100;
      const arriba = ((c.y - y0) / filas) * 100;
      return (
        izquierda >= MARGEN &&
        izquierda <= 100 - MARGEN &&
        arriba >= MARGEN &&
        arriba <= 100 - MARGEN
      );
    });

    // En el zoom más lejano se acepta lo que haya: es el mundo entero y no
    // queda nada que alejar.
    if (dentro || z === ZOOM_MIN) elegido = { zoom: z, x0, y0 };
  }

  const { zoom, x0, y0 } = elegido;

  const teselas = [];
  for (let fila = 0; fila < filas; fila += 1) {
    for (let col = 0; col < columnas; col += 1) {
      const x = x0 + col;
      const y = y0 + fila;
      teselas.push({ clave: `${zoom}/${x}/${y}`, url: `${TESELAS}/${zoom}/${x}/${y}.png` });
    }
  }

  const situar = (p) => {
    const c = aTesela(p.lat, p.lng, zoom);
    return {
      ...p,
      izquierda: ((c.x - x0) / columnas) * 100,
      arriba: ((c.y - y0) / filas) * 100,
    };
  };

  return {
    zoom,
    columnas,
    filas,
    teselas,
    puntos: conPunto.map(situar),
    ficha: valido(ficha) ? situar(ficha) : null,
  };
}
