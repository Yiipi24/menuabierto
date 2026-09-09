// El DENUE del INEGI, traducido a fichas.
//
// El Directorio Estadístico Nacional de Unidades Económicas es público, se
// descarga en CSV por entidad o por municipio, y trae de cada negocio lo que
// una ficha no reclamada necesita: nombre, dirección, colonia, municipio,
// coordenadas, teléfono y su clase de actividad. No trae menú, ni precios, ni
// horarios, y aquí no se inventan: una ficha sembrada enseña lo que el INEGI
// sabe y dice de dónde lo sabe.
//
// Este archivo es la parte que no habla con nadie —leer el CSV, limpiar cada
// campo— para poder probarla sin base. El script `scripts/sembrar-denue.mjs`
// es el que la usa contra Supabase.

// Las clases SCIAN de "servicios de preparación de alimentos" que son un
// restaurante para este directorio. Cada una cae en una cocina del catálogo
// (`public.cuisines`); las que no tienen una cocina clara caen en null y la
// ficha sale sin categoría, que es mejor que una inventada.
export const CLASES_SCIAN = {
  722511: { nombre: "Restaurantes con servicio de preparación de alimentos a la carta o de comida corrida", cocina: "comida-corrida" },
  722512: { nombre: "Restaurantes con servicio de preparación de pescados y mariscos", cocina: "mariscos" },
  722513: { nombre: "Restaurantes con servicio de preparación de antojitos", cocina: "antojitos" },
  722514: { nombre: "Restaurantes con servicio de preparación de tacos y tortas", cocina: "tacos" },
  722515: { nombre: "Cafeterías, fuentes de sodas, neverías, refresquerías y similares", cocina: "desayunos" },
  722516: { nombre: "Restaurantes de autoservicio", cocina: null },
  722517: { nombre: "Restaurantes con servicio de preparación de pizzas, hamburguesas, hot dogs y pollos rostizados para llevar", cocina: "hamburguesas" },
  722518: { nombre: "Restaurantes que preparan otro tipo de alimentos para llevar", cocina: null },
  722519: { nombre: "Servicios de preparación de otros alimentos para consumo inmediato", cocina: null },
};

// Palabras del nombre que, si aparecen, dicen más de la cocina que la clase
// SCIAN: "TAQUERIA EL GORDO" está registrado como comida corrida la mitad de
// las veces. Se prueban en orden y gana la primera.
const PISTAS_DE_COCINA = [
  [/\btaqu|tacos?\b|\bpastor\b/, "tacos"],
  [/\bmarisc|\bpescad|\bostion|\bcamaron|\bceviche/, "mariscos"],
  [/\bpizz/, "pizza"],
  [/\bhamburgu|\bburger/, "hamburguesas"],
  [/\bsushi|\bjapon|\bramen/, "sushi"],
  [/\bchin[ao]\b|\bcanton|\bwok\b/, "china"],
  [/\bitalian|\bpast[ae]s?\b|\btrattor/, "italiana"],
  [/\bcafe\b|\bcafeter|\bdesayun|\bcoffee/, "desayunos"],
  [/\bpasteler|\breposter|\bpostres?\b|\bneveria|\bhelad/, "postres"],
  [/\bpollos?\b|\brostizad/, "pollo"],
  [/\bbirria|\bbarbacoa/, "birria"],
  [/\btortas?\b|\bsandwich|\bbaguet/, "tortas"],
  [/\bcarnes?\b|\basador|\bparrill|\barrachera/, "parrilla"],
  [/\bcortes?\b|\bsteak/, "cortes"],
  [/\bbbq\b|\bahumad|\bsmoke/, "bbq"],
  [/\bvegan|\bvegetarian/, "vegetariana"],
  [/\bsalud|\bbowl|\bensalad/, "saludable"],
  [/\bbar\b|\bcervecer|\bcantina/, "bar"],
  [/\bcomida corrida|\bfonda\b|\bcocina economica/, "comida-corrida"],
  [/\bantojit|\bgordit|\bquesadill|\bsopes?\b|\btamal|\bpozol/, "antojitos"],
  [/\barabe|\bliban|\bkebab|\bshawarma/, "arabe"],
  [/\bcorean/, "coreana"],
  [/\bperuan/, "peruana"],
  [/\bargentin/, "argentina"],
  [/\bthai\b|\btailand/, "thai"],
  [/\bindi[ao]\b|\bcurry/, "india"],
];

function sinAcentos(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function esRestaurante(codigoAct) {
  return Object.prototype.hasOwnProperty.call(CLASES_SCIAN, String(codigoAct ?? "").trim());
}

/**
 * La cocina de una fila: primero lo que dice el nombre, después la clase.
 * Devuelve el slug del catálogo o null.
 */
export function cocinaDe(nombre, codigoAct) {
  const texto = sinAcentos(nombre);
  for (const [patron, slug] of PISTAS_DE_COCINA) {
    if (patron.test(texto)) return slug;
  }
  return CLASES_SCIAN[String(codigoAct ?? "").trim()]?.cocina ?? null;
}

// Palabras que en un nombre van en minúscula salvo al principio. Los
// artículos no están: "El Gordo" y "La Esquina" son parte del nombre propio.
const MENORES = new Set(["de", "del", "y", "e", "a", "al", "en", "con", "para", "por", "sin"]);
// Siglas y marcas que se escriben como están.
const TAL_CUAL = new Set(["bbq", "kfc", "vips", "ihop", "sa", "cv", "sc", "srl"]);

/**
 * El DENUE escribe todo en mayúsculas: "TAQUERIA EL GORDO SA DE CV". La ficha
 * no. Se pasa a título respetando las palabras chicas y se quita la cola
 * societaria, que no es el nombre del local sino el de la empresa.
 */
export function nombreLegible(bruto) {
  let texto = String(bruto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    // "S.A. DE C.V.", "SA DE CV", "S DE RL DE CV", "SAPI DE CV" y variantes.
    .replace(/[,\s]+(s\.?\s?a\.?(\s?p\.?\s?i\.?)?|s\.?\s?c\.?|s\.?\s?(de\s)?r\.?\s?l\.?)(\s?de\s?c\.?\s?v\.?)?\.?$/i, "")
    .replace(/[,\s]+de\s?c\.?\s?v\.?$/i, "")
    .trim();

  if (!texto) return "";

  // Si ya viene mezclado (mayúsculas y minúsculas), el dueño lo escribió así.
  if (texto !== texto.toUpperCase()) return texto;

  return texto
    .toLowerCase()
    .split(" ")
    .map((palabra, i) => {
      if (TAL_CUAL.has(palabra)) return palabra.toUpperCase();
      if (i > 0 && MENORES.has(palabra)) return palabra;
      // "D'ANGELO", "MC DONALD'S": cada tramo tras apóstrofo o guion también.
      // "D'ANGELO", "MC-DONALD", "\"EL GORDO\"": también tras apóstrofo, guion
      // o comilla.
      return palabra.replace(/(^|['’"«(-])(\p{L})/gu, (m, sep, letra) => sep + letra.toUpperCase());
    })
    .join(" ");
}

// Los valores con los que el DENUE dice "no hay dato".
const VACIOS = new Set(["", "0", "ninguno", "ninguna", "sin nombre", "sn", "s/n", "n/a", "na", "no aplica", "-"]);

export function limpio(valor) {
  const texto = String(valor ?? "").replace(/\s+/g, " ").trim();
  return VACIOS.has(sinAcentos(texto)) ? "" : texto;
}

/**
 * La calle con su número, como se escribe en una dirección: "Av. Juárez 120".
 * El tipo de vialidad viene aparte ("AVENIDA", "CALLE"); "CALLE" se omite
 * porque no aporta, y los demás se abrevian como se leen en un letrero.
 */
const VIALIDADES = {
  avenida: "Av.",
  boulevard: "Blvd.",
  bulevar: "Blvd.",
  calzada: "Calz.",
  carretera: "Carr.",
  prolongacion: "Prol.",
  privada: "Priv.",
  callejon: "Callejón",
  andador: "Andador",
  cerrada: "Cerrada",
  circuito: "Circuito",
  periferico: "Periférico",
  eje: "Eje",
  camino: "Camino",
  pasaje: "Pasaje",
};

export function calleDe(fila) {
  const tipo = sinAcentos(limpio(fila.tipo_vial));
  const nombre = nombreLegible(limpio(fila.nom_vial));
  if (!nombre) return null;
  const prefijo = tipo && tipo !== "calle" ? (VIALIDADES[tipo] ?? nombreLegible(tipo)) : "";
  const exterior = limpio(fila.numero_ext);
  const letra = limpio(fila.letra_ext);
  const interior = limpio(fila.numero_int);
  const numero = [exterior ? exterior + (letra ? `-${letra}` : "") : "", interior ? `Int. ${interior}` : ""]
    .filter(Boolean)
    .join(" ");
  return [prefijo, nombre, numero].filter(Boolean).join(" ");
}

// Diez dígitos, como se marcan en México. Con lada 52 delante también vale.
export function telefonoDe(bruto) {
  const digitos = String(bruto ?? "").replace(/\D/g, "");
  if (digitos.length === 10) return digitos;
  if (digitos.length === 12 && digitos.startsWith("52")) return digitos.slice(2);
  return null;
}

export function sitioDe(bruto) {
  const texto = limpio(bruto).toLowerCase();
  if (!texto || !/\./.test(texto) || /\s/.test(texto)) return null;
  if (/@/.test(texto)) return null;
  return /^https?:\/\//.test(texto) ? texto : `https://${texto}`;
}

export function coordenadaDe(valor, tope) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) && n !== 0 && Math.abs(n) <= tope ? n : null;
}

// El código postal viene a veces sin el cero de la izquierda.
export function codigoPostalDe(bruto) {
  const digitos = String(bruto ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  return digitos.padStart(5, "0").slice(0, 5);
}

/**
 * Una fila del CSV del DENUE, convertida a lo que se inserta en `restaurants`
 * más la cocina que le toca. Devuelve null si no es un restaurante o no tiene
 * lo mínimo (nombre y municipio).
 */
export function fichaDesdeFila(fila) {
  if (!esRestaurante(fila.codigo_act)) return null;

  const nombre = nombreLegible(limpio(fila.nom_estab)) || nombreLegible(limpio(fila.raz_social));
  const ciudad = nombreLegible(limpio(fila.municipio));
  const id = limpio(fila.id);
  if (!nombre || !ciudad || !id) return null;

  const lat = coordenadaDe(fila.latitud, 90);
  const lng = coordenadaDe(fila.longitud, 180);

  return {
    source: "denue",
    source_id: id,
    name: nombre.slice(0, 120),
    street: calleDe(fila),
    neighborhood: nombreLegible(limpio(fila.nomb_asent)) || null,
    city: ciudad,
    state: nombreLegible(limpio(fila.entidad)) || null,
    postal_code: codigoPostalDe(fila.cod_postal),
    phone: telefonoDe(fila.telefono),
    website: sitioDe(fila.www),
    lat,
    lng,
    cocina: cocinaDe(nombre, fila.codigo_act),
    clase: CLASES_SCIAN[String(fila.codigo_act).trim()]?.nombre ?? null,
  };
}

/**
 * Lector de CSV suficiente para el del INEGI: comillas dobles, comillas
 * escapadas duplicándolas, saltos de línea dentro de comillas y BOM. Las
 * cabeceras se normalizan a minúsculas sin acentos para que "Código de la
 * clase de actividad SCIAN" y "codigo_act" acaben en la misma llave.
 */
export const CABECERAS = {
  "id": "id",
  "nombre de la unidad economica": "nom_estab",
  "nom_estab": "nom_estab",
  "razon social": "raz_social",
  "raz_social": "raz_social",
  "codigo de la clase de actividad scian": "codigo_act",
  "codigo_act": "codigo_act",
  "nombre de la clase de la actividad": "nombre_act",
  "nombre_act": "nombre_act",
  "tipo de vialidad": "tipo_vial",
  "tipo_vial": "tipo_vial",
  "nombre de la vialidad": "nom_vial",
  "nom_vial": "nom_vial",
  "numero exterior o kilometro": "numero_ext",
  "numero_ext": "numero_ext",
  "letra exterior": "letra_ext",
  "letra_ext": "letra_ext",
  "numero interior": "numero_int",
  "numero_int": "numero_int",
  "tipo de asentamiento humano": "tipo_asent",
  "tipo_asent": "tipo_asent",
  "nombre de asentamiento humano": "nomb_asent",
  "nomb_asent": "nomb_asent",
  "codigo postal": "cod_postal",
  "cod_postal": "cod_postal",
  "entidad federativa": "entidad",
  "entidad": "entidad",
  "municipio": "municipio",
  "localidad": "localidad",
  "telefono": "telefono",
  "numero de telefono": "telefono",
  "correo electronico": "correoelec",
  "correoelec": "correoelec",
  "sitio en internet": "www",
  "www": "www",
  "latitud": "latitud",
  "longitud": "longitud",
  "fecha de incorporacion al denue": "fecha_alta",
  "fecha_alta": "fecha_alta",
};

function llaveDeCabecera(texto) {
  const limpia = sinAcentos(texto).replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
  return CABECERAS[limpia] ?? limpia.replace(/[^a-z0-9]+/g, "_");
}

export function leerCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;
  const s = String(texto ?? "").replace(/^\uFEFF/, "");

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (entreComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      fila.push(campo);
      campo = "";
      if (fila.some((v) => v.trim() !== "")) filas.push(fila);
      fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    if (fila.some((v) => v.trim() !== "")) filas.push(fila);
  }

  if (!filas.length) return [];
  const llaves = filas[0].map(llaveDeCabecera);
  return filas.slice(1).map((valores) => {
    const objeto = {};
    llaves.forEach((llave, i) => {
      objeto[llave] = valores[i] ?? "";
    });
    return objeto;
  });
}

// Lo que enseña la ficha para decir de dónde salió lo que dice.
export const FUENTE_DENUE = {
  nombre: "DENUE del INEGI",
  url: "https://www.inegi.org.mx/app/mapa/denue/",
};
