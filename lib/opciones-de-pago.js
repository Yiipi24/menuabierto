// Lo que el selector de planes ofrece a una ficha (`app/panel/planes`), plan
// por plan y forma de pago por forma de pago. Vive aquí, con pruebas, porque
// repite las reglas que comprueban las acciones: si el selector ofrece algo
// que la acción rechaza, el dueño ve un error después de elegir.

import { PLANES, ordenDePlan, subeOMantiene } from "./planes";
import {
  MESES_POR_ADELANTADO,
  MONEDA,
  admiteOxxo,
  cobroAutomaticoActivo,
  mesesLegibles,
  precioDe,
  totalPorAdelantado,
} from "./cobro";
import { pesos } from "./precios";

// Cada forma de pago que no se puede trae su razón, para decirla en vez de
// solo apagar la opción.
export function planesParaElegir({ vigente, suscripcion, viva, adelanto, porCobrar }) {
  const planConCobroMensual = viva ? suscripcion.plan : vigente;
  const automatico = cobroAutomaticoActivo(suscripcion);

  return PLANES.filter((p) => p.slug !== "basico").map((p) => {
    // Cada mes con tarjeta (`contratarPlan`). Las dos formas de pagar no se
    // juntan: con una corriendo, la otra cobraría dos veces el mismo mes.
    let sinMensual = null;
    if (adelanto) {
      sinMensual = "Ya pagaste meses por adelantado: el cobro automático se puede activar cuando venzan.";
    } else if (porCobrar) {
      sinMensual = "Tienes un pago en OXXO o SPEI por hacer. Págalo, o espera a que venza.";
    } else if (p.slug === planConCobroMensual) {
      sinMensual = viva ? "Ya lo pagas cada mes con tarjeta." : "Es el plan que ya tienes.";
    }

    // Por adelantado (`pagarPorAdelantado`): el mismo plan o uno más alto, y
    // con una ficha de OXXO por pagar, solo el de esa ficha.
    let sinAdelanto = null;
    if (automatico) {
      sinAdelanto =
        "Tienes el cobro automático activo. Para pagar por adelantado, cancélalo primero: lo que ya pagaste se respeta.";
    } else if (porCobrar && porCobrar.plan !== p.slug) {
      sinAdelanto = "Tienes un pago en OXXO o SPEI por hacer de otro plan. Págalo, o espera a que venza.";
    } else if (!subeOMantiene(vigente, p.slug)) {
      sinAdelanto = "Por adelantado puedes quedarte en tu plan o subir; para bajar, espera a que venza el que tienes.";
    }

    const adelantos = sinAdelanto
      ? []
      : MESES_POR_ADELANTADO.map((m) => {
          const total = totalPorAdelantado(p.slug, m);
          return { meses: m, etiqueta: mesesLegibles(m), total: pesos(total, MONEDA), sinOxxo: !admiteOxxo(total) };
        });

    return {
      slug: p.slug,
      nombre: p.nombre,
      orden: ordenDePlan(p.slug),
      precioMensual: pesos(precioDe(p.slug), MONEDA),
      actual: p.slug === vigente,
      mensual: !sinMensual,
      sinMensual,
      adelantos,
      sinAdelanto,
    };
  });
}
