// Convierte la dirección que escribe el dueño en un punto, para que no tenga
// que copiar coordenadas de ningún lado. Sin punto, la ficha sale en las
// búsquedas por colonia o ciudad pero nunca con su distancia, así que
// "Más cercanos" no ordena nada.
//
// Se usa Nominatim (OpenStreetMap) y no el geocodificador de Google porque los
// términos de Google Maps Platform restringen guardar las coordenadas de forma
// permanente, y aquí el punto se guarda en la base para siempre. Los datos de
// OSM son ODbL: se pueden almacenar dando atribución.

// Configurable para poder apuntar a una instancia propia o a un proveedor
// compatible (LocationIQ, Photon): la política de OSM pide justamente eso si
// el volumen crece, y su servidor público deja de ser suficiente.
const NOMINATIM =
  process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";

// Nominatim exige identificar la aplicación y una forma de contacto. Sin esto
// bloquean por abuso, y con razón: es un servicio gratuito.
const CONTACTO = process.env.NOMINATIM_CONTACTO || "hola@menuabierto.com";
const AGENTE = `MenuAbierto/1.0 (+https://menuabierto.com; ${CONTACTO})`;

const ESPERA_MS = 4000;
// Su política pide no pasar de una consulta por segundo. Entre el intento fino
// y el grueso se deja ese hueco; solo se paga cuando el primero no acertó.
const PAUSA_MS = 1100;
// Techo para todos los intentos juntos. Sin esto, tres consultas lentas
// sumarían más de lo que dura una función serverless, y un servicio ajeno
// tumbaría el guardado de la ficha.
const PRESUPUESTO_MS = 9000;

function dormir(ms) {
  return new Promise((listo) => setTimeout(listo, ms));
}

// De lo más específico a lo más vago. La primera que acierte gana, así que una
// dirección completa da un punto en la calle y una a medias, uno en la colonia.
// Es mejor que nada: con radio de 15 km, la colonia ya ubica bien.
//
// Cada candidata necesita algo que la distinga: calle, colonia o código postal.
// Una consulta de pura ciudad y estado devuelve el centro de la ciudad, que
// parece un dato y no lo es — preferimos no tener punto a tener uno inventado.
function consultas({ street, neighborhood, city, state, postal_code }) {
  const pais = "México";
  const candidatas = [
    [street || neighborhood || postal_code, [street, neighborhood, city, state, postal_code, pais]],
    [neighborhood, [neighborhood, city, state, pais]],
    [postal_code, [postal_code, city, state, pais]],
  ];

  const vistas = new Set();
  const salida = [];
  for (const [distintivo, partes] of candidatas) {
    if (!distintivo) continue;
    const texto = partes.filter(Boolean).join(", ");
    if (texto && !vistas.has(texto)) {
      vistas.add(texto);
      salida.push(texto);
    }
  }
  return salida;
}

async function preguntar(texto) {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", texto);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  // El directorio es de México; acotar el país evita que "Escobedo" caiga en
  // un pueblo español con el mismo nombre.
  url.searchParams.set("countrycodes", "mx");

  const respuesta = await fetch(url, {
    headers: { "User-Agent": AGENTE, "Accept-Language": "es" },
    signal: AbortSignal.timeout(ESPERA_MS),
    cache: "no-store",
  });

  if (!respuesta.ok) return null;

  const datos = await respuesta.json();
  const primero = Array.isArray(datos) ? datos[0] : null;
  if (!primero) return null;

  const lat = Number(primero.lat);
  const lng = Number(primero.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

// Devuelve { lat, lng } o null. Nunca lanza: que un servicio de terceros esté
// caído no puede tumbar el guardado de una ficha. Sin punto la ficha se guarda
// igual, y el dueño siempre puede escribirlo a mano.
export async function geocodificar(direccion) {
  const intentos = consultas(direccion);
  const limite = Date.now() + PRESUPUESTO_MS;

  for (const [i, texto] of intentos.entries()) {
    if (i > 0) {
      // Ni empezar una consulta que no cabe en lo que queda de presupuesto.
      if (Date.now() + PAUSA_MS + ESPERA_MS > limite) break;
      await dormir(PAUSA_MS);
    }
    try {
      const punto = await preguntar(texto);
      if (punto) return punto;
    } catch (error) {
      // Timeout, red caída o JSON roto. Se intenta la siguiente consulta.
      console.error("geocodificar", texto, error.message);
    }
  }

  return null;
}

// Dos direcciones son la misma si sus campos relevantes coinciden. Sirve para
// no volver a preguntar en cada guardado: sin esto, corregir una falta de
// ortografía en el resumen dispararía una consulta a Nominatim.
export function mismaDireccion(a, b) {
  const campos = ["street", "neighborhood", "city", "state", "postal_code"];
  return campos.every(
    (c) => (a?.[c] ?? "").trim().toLowerCase() === (b?.[c] ?? "").trim().toLowerCase(),
  );
}
