import { PLANES } from "../../lib/planes";
import { MONEDA, TASA_IVA, TOPE_OXXO_CENTAVOS, conIva, precioDe } from "../../lib/cobro";
import { pesos } from "../../lib/precios";
import {
  IconoCorona,
  IconoDiamante,
  IconoInfo,
  IconoPalomita,
  IconoTienda,
  IconoWhatsapp,
} from "../panel/tablero-iconos";

// El catálogo de planes y las formas de pago, los mismos en la página pública
// (/planes) y en el panel (/panel/planes): una sola copia para que las dos no
// puedan anunciar precios distintos. Los precios salen de lib/cobro.js, que es
// lo que se le manda a la pasarela.

const ICONOS_PLAN = {
  basico: IconoTienda,
  plus: IconoCorona,
  premium: IconoDiamante,
  pedidos: IconoWhatsapp,
};

const PORCENTAJE_IVA = `${Math.round(TASA_IVA * 100)}%`;

// Lo que más se compara entre planes es cuántos menús caben: en la lista de
// cada tarjeta, la cifra va en negritas.
function conCifras(texto) {
  return texto.split(/(\d+ menús)/).map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : parte));
}

export function CatalogoDePlanes() {
  return (
    <section className="planes-grid" aria-label="Comparación de planes">
      {PLANES.map((p) => {
        const Icono = ICONOS_PLAN[p.slug] ?? IconoTienda;
        const centavos = precioDe(p.slug);
        return (
          <article
            className={p.destacado ? "plan-tarjeta plan-tarjeta-recomendada" : "plan-tarjeta"}
            key={p.slug}
          >
            {p.destacado ? <span className="plan-recomendado">Recomendado</span> : null}
            <span className="plan-tarjeta-icono">
              <Icono ancho={22} />
            </span>
            <h2>{p.nombre}</h2>
            <p className="plan-tarjeta-precio">
              {centavos ? pesos(centavos, MONEDA) : p.precio}
              <span>{centavos ? `${MONEDA} al mes + IVA` : p.detalle}</span>
            </p>
            {centavos ? (
              <p className="plan-tarjeta-iva">{pesos(conIva(centavos), MONEDA)} al mes con IVA</p>
            ) : null}
            <p className="plan-tarjeta-resumen">{p.resumen}</p>
            <ul>
              {p.incluye.map((linea) => (
                <li key={linea}>
                  <IconoPalomita ancho={16} />
                  <span>{conCifras(linea)}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}

export function FormasDePago() {
  return (
    <section className="formas-de-pago" aria-labelledby="titulo-formas-de-pago">
      <div className="formas-de-pago-titulo">
        <span className="formas-de-pago-icono">
          <IconoInfo ancho={20} />
        </span>
        <h2 id="titulo-formas-de-pago">Formas de pago</h2>
      </div>
      <dl className="formas-de-pago-lista">
        <div>
          <dt>Cada mes</dt>
          <dd>
            Cobro automático con tarjeta de crédito o de débito, con Mercado Pago. Lo cancelas cuando
            quieras.
          </dd>
        </div>
        <div>
          <dt>Por adelantado</dt>
          <dd>
            De uno a doce meses en un solo pago: OXXO, SPEI, saldo de Mercado Pago o tarjeta. En OXXO,
            hasta {pesos(TOPE_OXXO_CENTAVOS, MONEDA)} por pago; lo que pase de eso, por SPEI, con saldo
            o con tarjeta.
          </dd>
        </div>
        <div>
          <dt>IVA</dt>
          <dd>
            Los precios de los planes son antes de IVA, en pesos mexicanos. Al pagar se agrega el IVA
            del {PORCENTAJE_IVA}: lo que cobra Mercado Pago es el total con IVA que ves al elegir.
          </dd>
        </div>
        <div>
          <dt>Al vencer o cancelar</dt>
          <dd>
            Lo pagado por adelantado no se renueva solo: al vencer, pagas otros meses o activas el cobro
            automático. Un plan que se cancela o deja de pagarse vuelve a Básico al vencer; tus menús de
            más siguen guardados, pero no se ven hasta que renueves o borres los que sobren.
          </dd>
        </div>
        <div>
          <dt>Bueno saber</dt>
          <dd>
            En Pedidos, los mensajes de WhatsApp los cobra Meta aparte, a la tarjeta de tu cuenta de
            WhatsApp. Si estás en la lista de espera, conservas el precio de lanzamiento el primer año.
            La factura fiscal (CFDI) todavía no se emite desde aquí.
          </dd>
        </div>
      </dl>
    </section>
  );
}
