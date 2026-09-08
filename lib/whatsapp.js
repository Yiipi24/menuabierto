// Pedir por WhatsApp. Aquí no hay carrito ni pasarela: el pedido termina
// siendo un mensaje escrito en el chat del restaurante, que es como ya se pide
// en la mitad de los locales de este directorio. Lo único que hace el sitio es
// escribir ese mensaje bien —con los platillos, sus cantidades y el enlace de
// la carta— para que el dueño no tenga que preguntar tres veces qué quisieron.
//
// Por eso vive en `lib` y no dentro de un componente: el número lo valida el
// panel al guardarlo, el enlace lo arma la ficha, y el mensaje lo arma la
// carta. Los tres tienen que estar de acuerdo en cómo se escribe un número.

import { pesos } from "./precios";

// México. Un dueño escribe su celular como lo dicta: "81 1234 5678". El resto
// del mundo escribe su lada, y quien la escribe la escribe con `+`.
export const LADA_POR_DEFECTO = "52";

export const MAX_NOTA = 120;

/**
 * El número tal como lo quiere wa.me: solo dígitos, con lada y sin `+`.
 *
 * Devuelve `null` si no escribieron nada —no tener WhatsApp es una respuesta
 * válida— y `undefined` si lo escrito no es un teléfono. Es la misma
 * convención de `aCentavos`, y por lo mismo: el panel necesita distinguir
 * "vacío" de "mal escrito" para saber si avisar.
 */
export function telefonoWhatsapp(bruto) {
  const texto = String(bruto ?? "").trim();
  if (!texto) return null;

  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return undefined;

  // El "1" que México usaba después del 52 para celulares. WhatsApp ya no lo
  // quiere, pero sigue copiado en media agenda del país y en los contactos que
  // el dueño exporta de su teléfono.
  const sinUno =
    digitos.length === 13 && digitos.startsWith("521")
      ? `${LADA_POR_DEFECTO}${digitos.slice(3)}`
      : digitos;

  // Diez dígitos son un número mexicano sin lada, que es como se dictan aquí.
  const conLada = sinUno.length === 10 ? `${LADA_POR_DEFECTO}${sinUno}` : sinUno;

  // Once dígitos es lo más corto que existe con lada (un +1 de Norteamérica) y
  // quince es el tope del estándar E.164.
  return conLada.length >= 11 && conLada.length <= 15 ? conLada : undefined;
}

// Para enseñarlo: "+52 81 1234 5678".
//
// Solo se parte el mexicano, que es el de casi todas las fichas y el único
// cuya forma se reconoce de un vistazo. Los demás salen enteros a propósito:
// partir un número español de nueve dígitos con la regla de diez lo deja
// diciendo "+3 46 1234 5678", que no es el número de nadie.
export function telefonoLegible(telefono) {
  const digitos = String(telefono ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length !== 12 || !digitos.startsWith(LADA_POR_DEFECTO)) return `+${digitos}`;
  const resto = digitos.slice(2);
  return `+${LADA_POR_DEFECTO} ${resto.slice(0, 2)} ${resto.slice(2, 6)} ${resto.slice(6)}`;
}

/**
 * El enlace que abre el chat con el mensaje ya escrito.
 *
 * `wa.me` y no `api.whatsapp.com` porque es el que abre la aplicación en el
 * teléfono —que es donde está casi todo el mundo que lee una carta por QR— y
 * cae solo a WhatsApp Web en la computadora.
 */
export function enlaceWhatsapp(telefono, texto) {
  if (!telefono) return null;
  const mensaje = String(texto ?? "").trim();
  return mensaje
    ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
    : `https://wa.me/${telefono}`;
}

/**
 * Los pedidos de un restaurante, ya limpios, o `null` si no toma pedidos.
 *
 * La base guarda las tres columnas por separado —el interruptor, el número y
 * la nota— y la ficha no debería tener que cruzarlas cada vez que las pinta.
 * Un interruptor prendido sin número no es un canal de pedidos: es un botón
 * que no lleva a ningún lado, y se apaga aquí.
 */
export function pedidosDe(r) {
  if (!r?.whatsapp_orders) return null;
  const telefono = telefonoWhatsapp(r.whatsapp_phone);
  if (!telefono) return null;
  return {
    telefono,
    nota: String(r.whatsapp_note ?? "").trim().slice(0, MAX_NOTA) || null,
  };
}

// El saludo. Va en el mensaje aunque quien pide vaya a escribir encima: un
// chat que empieza con "Hola, vengo de Menú Abierto" le dice al dueño de dónde
// salió la venta sin que nadie tenga que preguntárselo.
function saludo(nombre) {
  return `Hola${nombre ? ` ${nombre}` : ""}, los vi en Menú Abierto.`;
}

/**
 * El mensaje del botón de la ficha: quien lo toca todavía no eligió nada.
 * Se deja a medias a propósito —termina en dos puntos— para que el cursor de
 * WhatsApp caiga donde la persona tiene que escribir.
 */
export function mensajeDeContacto(nombre, url) {
  return [saludo(nombre), "Quiero hacer un pedido:", url].filter(Boolean).join("\n");
}

/**
 * El mensaje de un pedido armado desde la carta.
 *
 * El total va como referencia y lo dice: los precios de la carta pueden ir una
 * hora por detrás de la cocina, y un número que el restaurante no confirmó no
 * puede presentarse como la cuenta. Quien cobra sigue siendo el local.
 */
export function mensajeDePedido({ nombre, url, lineas, moneda = "MXN" }) {
  const platillos = (lineas ?? []).filter((l) => l?.cantidad > 0);
  if (!platillos.length) return mensajeDeContacto(nombre, url);

  const renglones = platillos.map((l) => {
    const importe =
      l.precio == null ? null : pesos(Number(l.precio) * Number(l.cantidad), moneda);
    return `• ${l.cantidad} × ${l.nombre}${importe ? ` — ${importe}` : ""}`;
  });

  const total = platillos.reduce(
    (suma, l) => (l.precio == null ? suma : suma + Number(l.precio) * Number(l.cantidad)),
    0,
  );
  // Si ningún platillo del pedido trae precio, no hay total que dar: un
  // "Total: $0" sería mentira, no un dato faltante.
  const conPrecio = platillos.some((l) => l.precio != null);

  return [
    saludo(nombre),
    "Mi pedido:",
    ...renglones,
    conPrecio ? `Total aproximado: ${pesos(total, moneda)} (a confirmar con ustedes)` : null,
    url,
  ]
    .filter(Boolean)
    .join("\n");
}
