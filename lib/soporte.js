// La ayuda: por dónde se le escribe a Menú Abierto y las preguntas frecuentes
// de /ayuda (criterio 6 del tablero, #83). Vive aquí y no en la página por lo
// mismo que los planes: las respuestas citan precios, cupos y plazos que ya
// tienen dueño en `lib/`, y una pregunta frecuente que dice $199 cuando el
// cobro dice $249 es peor que no tener ninguna. Por eso las cifras se leen de
// donde se cobran, no se escriben.

import { DIAS_DE_GRACIA, MONEDA, PLANES_DE_PAGA, TASA_IVA, TOPE_OXXO_CENTAVOS, precioConIva, precioDe } from "./cobro";
import { LECTURAS_POR_MES } from "./extraccion";
import { PLANES } from "./planes";
import { pesos } from "./precios";
import { enlaceWhatsapp, telefonoLegible, telefonoWhatsapp } from "./whatsapp";

export const CORREO_DE_SOPORTE = "hola@menuabierto.com";

// El WhatsApp de soporte se prende con una variable (`SOPORTE_WHATSAPP`), no
// en el código: es un número de una persona, cambia sin desplegar y no se
// publica antes de que alguien lo conteste. Mal escrito cuenta como ausente:
// un enlace a un número que no existe es peor que no ofrecerlo.
export function whatsappDeSoporte(bruto = process.env.SOPORTE_WHATSAPP) {
  return telefonoWhatsapp(bruto) || null;
}

export function enlaceDeCorreo(correo, asunto) {
  if (!correo) return null;
  const tema = String(asunto ?? "").trim();
  return tema ? `mailto:${correo}?subject=${encodeURIComponent(tema)}` : `mailto:${correo}`;
}

/**
 * Los canales para pedir ayuda, en el orden en que conviene ofrecerlos: el
 * WhatsApp primero cuando lo hay, porque es por donde un dueño escribe; el
 * correo siempre. `asunto` y `mensaje` dejan escrito de dónde viene la duda
 * (el panel, una ficha), que es la primera pregunta que habría que hacerle.
 */
export function canalesDeSoporte({
  correo = CORREO_DE_SOPORTE,
  whatsapp = whatsappDeSoporte(),
  asunto,
  mensaje,
} = {}) {
  const canales = [];
  if (whatsapp) {
    canales.push({
      tipo: "whatsapp",
      etiqueta: "WhatsApp",
      texto: telefonoLegible(whatsapp),
      href: enlaceWhatsapp(whatsapp, mensaje),
    });
  }
  if (correo) {
    canales.push({ tipo: "correo", etiqueta: "Correo", texto: correo, href: enlaceDeCorreo(correo, asunto) });
  }
  return canales;
}

const nombreDe = (slug) => PLANES.find((p) => p.slug === slug)?.nombre ?? slug;

// "Plus $199, Premium $399 y Pedidos $2,200": la lista en prosa, con su "y".
function enumerar(partes) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

function preciosDeLosPlanes() {
  const antes = enumerar(PLANES_DE_PAGA.map((s) => `${nombreDe(s)} ${pesos(precioDe(s), MONEDA)}`));
  const con = enumerar(PLANES_DE_PAGA.map((s) => pesos(precioConIva(s), MONEDA)));
  return { antes, con };
}

function lecturasPorPlan() {
  return enumerar(PLANES.map((p) => `${LECTURAS_POR_MES[p.slug]} en ${p.nombre}`));
}

const IVA = `${Math.round(TASA_IVA * 100)}%`;

/**
 * Las preguntas frecuentes, en dos grupos: quien tiene un restaurante y quien
 * busca dónde comer. Cada respuesta es texto plano —párrafos— para que la
 * página y los datos estructurados digan exactamente lo mismo, y los enlaces
 * van aparte, debajo de la respuesta.
 *
 * Solo se responde lo que el sitio hace hoy. Lo que todavía no existe (la
 * factura desde el sitio, por ejemplo) se dice así, en vez de callarlo.
 */
export function preguntasFrecuentes() {
  const precios = preciosDeLosPlanes();
  const basico = PLANES[0];

  return [
    {
      id: "duenos",
      titulo: "Si tienes un restaurante",
      preguntas: [
        {
          id: "cuanto-cuesta",
          pregunta: "¿Cuánto cuesta publicar mi restaurante?",
          respuesta: [
            `Publicar es gratis, para siempre. El plan ${basico.nombre} incluye tu ficha con ubicación y horarios, hasta ${basico.menus} menús y hasta ${basico.platillos} fotos de platillos, y apareces en las búsquedas de tu zona.`,
            `Los planes de paga cuestan, al mes, ${precios.antes} ${MONEDA} más IVA (${precios.con} con IVA). Cada restaurante tiene su propio plan y lo cambias cuando quieras.`,
          ],
          enlaces: [{ href: "/planes", texto: "Ver lo que incluye cada plan" }],
        },
        {
          id: "iva-y-factura",
          pregunta: "¿Los precios incluyen IVA? ¿Dan factura?",
          respuesta: [
            `Los precios de los planes son antes de IVA. Al pagar se agrega el ${IVA}, y lo que cobra Mercado Pago es el total con IVA que ves al elegir.`,
            "La factura fiscal (CFDI) todavía no se emite desde el sitio.",
          ],
        },
        {
          id: "formas-de-pago",
          pregunta: "¿Cómo puedo pagar?",
          respuesta: [
            "Cada mes, con cobro automático a tarjeta de crédito o de débito, por Mercado Pago.",
            `O por adelantado, de uno a doce meses en un solo pago: OXXO, SPEI, saldo de Mercado Pago o tarjeta. En OXXO, hasta ${pesos(TOPE_OXXO_CENTAVOS, MONEDA)} por pago.`,
          ],
        },
        {
          id: "cancelar",
          pregunta: "¿Puedo cancelar? ¿Qué pasa con mis menús?",
          respuesta: [
            "Sí, cuando quieras, desde Planes en tu panel. Tu plan sigue hasta el fin del periodo que ya pagaste y después vuelve a Básico.",
            "Los menús que pasen del cupo de Básico siguen guardados, pero no se ven hasta que renueves o borres los que sobren.",
            `Si falla un cobro con tarjeta, tu ficha conserva su plan ${DIAS_DE_GRACIA} días mientras Mercado Pago lo vuelve a intentar.`,
          ],
        },
        {
          id: "ya-aparece",
          pregunta: "Mi restaurante ya aparece y yo no lo subí. ¿Cómo lo controlo?",
          respuesta: [
            "Algunas fichas las cargamos del directorio público de negocios del INEGI (el DENUE) y llevan la marca «Sin verificar». Reclámala y pasa a controlar tu menú, tus precios, tus fotos y tus horarios.",
            "Si entras con un correo del mismo dominio que el sitio web del restaurante, la ficha es tuya al instante. Si no, la revisamos a mano.",
          ],
          enlaces: [{ href: "/reclamar", texto: "Reclamar mi restaurante" }],
        },
        {
          id: "carta-desde-foto",
          pregunta: "¿Tengo que capturar mi carta platillo por platillo?",
          respuesta: [
            "No. Tómale una foto a tu carta impresa, o sube el PDF, y la convertimos en secciones, platillos y precios.",
            "Antes de guardar revisas todo: puedes corregir, quitar o agregar, y nada entra a tu menú hasta que lo confirmas.",
            `Cada plan incluye lecturas al mes: ${lecturasPorPlan()}. Si prefieres, también puedes subir tu carta en PDF o en foto y enseñarla tal cual.`,
          ],
        },
        {
          id: "cambiar-precios",
          pregunta: "¿Cómo cambio un precio o un platillo?",
          respuesta: [
            "Desde tu panel, en Menús. Al guardar, tu página se actualiza en ese momento, y no hay que volver a imprimir nada.",
          ],
        },
        {
          id: "qr",
          pregunta: "¿El QR cambia si cambio mi menú?",
          respuesta: [
            "No. Tu QR es uno solo y lleva siempre a la misma dirección, aunque cambies el nombre, los menús o los precios: lo imprimes una vez.",
            "Lo descargas desde tu panel: el SVG para la imprenta y el PNG para Canva, Word o WhatsApp. Que mida al menos cinco centímetros por lado.",
          ],
        },
        {
          id: "pedidos",
          pregunta: "¿Puedo recibir pedidos? ¿Cobran comisión?",
          respuesta: [
            "Sí, y sin comisión, en todos los planes. Prende «Recibir pedidos por WhatsApp» en tu panel con tu número: tus clientes arman el pedido en tu carta y te llega el mensaje con los platillos, las cantidades y el total. Tú confirmas y cobras como siempre.",
            "En el plan Pedidos, además, un asistente contesta solo por WhatsApp (horario, menú, dirección y precios) y los pedidos te llegan al panel. Los mensajes de WhatsApp los cobra Meta aparte.",
          ],
        },
        {
          id: "resenas",
          pregunta: "¿Puedo contestar las reseñas?",
          respuesta: [
            "Sí: una respuesta por reseña, desde tu panel, y la puedes corregir después. Si una reseña es falsa u ofensiva, repórtala y la revisamos a mano.",
          ],
        },
        {
          id: "varios-restaurantes",
          pregunta: "¿Puedo manejar varios restaurantes con una cuenta?",
          respuesta: ["Sí. Cada restaurante tiene su propia ficha, su propio QR y su propio plan."],
        },
      ],
    },
    {
      id: "comensales",
      titulo: "Si buscas dónde comer",
      preguntas: [
        {
          id: "es-gratis",
          pregunta: "¿Usar Menú Abierto cuesta algo?",
          respuesta: [
            "No. Buscar, ver menús y precios, y pedir por WhatsApp es gratis y no pide cuenta. Para dejar una reseña sí necesitas una, y también es gratis.",
          ],
        },
        {
          id: "resena-verificada",
          pregunta: "¿Qué quiere decir «Verificada» en una reseña?",
          respuesta: [
            "Que quien la escribió estuvo ahí: escaneó el QR de la mesa en los siete días anteriores, o recibió su pedido por el asistente de WhatsApp del restaurante.",
            "Las demás reseñas también se ven; solo no llevan la marca.",
          ],
        },
        {
          id: "pedir",
          pregunta: "¿Puedo pedir desde aquí?",
          respuesta: [
            "Si el restaurante lo tiene activado, sí: armas tu pedido en su carta y «Enviar por WhatsApp» abre el chat con la lista ya escrita.",
            "El restaurante confirma, prepara y cobra; Menú Abierto no cobra nada. El total es aproximado hasta que el restaurante lo confirma.",
          ],
        },
        {
          id: "sin-verificar",
          pregunta: "¿Por qué algunas fichas dicen «Sin verificar»?",
          respuesta: [
            "Son restaurantes que cargamos del directorio público del INEGI y que su dueño todavía no reclama. Traen nombre y dirección, a veces teléfono, pero no menú, precios ni horarios.",
          ],
        },
        {
          id: "algo-mal",
          pregunta: "Vi un dato equivocado o una reseña ofensiva. ¿Qué hago?",
          respuesta: [
            "Cada reseña trae su botón «Reportar», y la revisamos a mano. Para un dato equivocado de un restaurante, escríbenos con el nombre del lugar y qué está mal.",
          ],
        },
      ],
    },
  ];
}

/**
 * Las mismas preguntas como `FAQPage` de schema.org. Las respuestas se unen en
 * un solo texto: es lo que se lee en la página, párrafo por párrafo.
 */
export function jsonLdPreguntas(grupos, url) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url,
    inLanguage: "es-MX",
    mainEntity: grupos.flatMap((g) =>
      g.preguntas.map((p) => ({
        "@type": "Question",
        name: p.pregunta,
        acceptedAnswer: { "@type": "Answer", text: p.respuesta.join(" ") },
      })),
    ),
  };
}
