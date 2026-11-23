import { MAX_ZONAS } from "../../../lib/envio";

// El envío y los tiempos (#97), dentro del bloque de pedidos por WhatsApp.
//
// Los campos van siempre en el formulario y solo se esconden: con los pedidos
// apagados, o sin servicio a domicilio, el guardado no puede borrar las zonas
// que el dueño ya había puesto. Es la misma razón por la que el número de
// WhatsApp viaja escondido cuando el interruptor está apagado.
export default function EnvioDomicilio({ campos, visible, domicilio, conAsistente, sinPunto }) {
  return (
    <div className="envio" hidden={!visible}>
      <h3 className="envio-titulo">Envío y tiempos</h3>
      <p className="ayuda">
        {conAsistente
          ? "Tu asistente de WhatsApp los aplica: no confirma un pedido a domicilio por debajo del mínimo ni más lejos de tu última zona, suma el envío al total y le dice al cliente cuánto tarda."
          : "Salen junto al botón de pedir, en tu ficha y en tu carta. Con el plan Pedidos, tu asistente de WhatsApp además los aplica a cada pedido."}
      </p>

      <p className="ayuda" hidden={domicilio}>
        Para cobrar envío, marca «Servicio a domicilio» en los servicios de abajo.
      </p>

      <div hidden={!domicilio}>
        <div className="campo-par">
          <label className="campo">
            <span>
              Pedido mínimo a domicilio <em>(opcional)</em>
            </span>
            <input type="text" name="envio_minimo" inputMode="decimal" defaultValue={campos.minimo} placeholder="150" />
          </label>
          <label className="campo">
            <span>
              Envío gratis desde <em>(opcional)</em>
            </span>
            <input type="text" name="envio_gratis" inputMode="decimal" defaultValue={campos.gratis} placeholder="400" />
          </label>
        </div>

        <fieldset className="envio-zonas">
          <legend>Zonas de envío</legend>
          <p className="ayuda">
            Desde tu local, en línea recta. Deja vacía la distancia de la última
            zona para «más lejos», o la de la única para cobrar un envío fijo.
            Si no cobras envío en una zona, escribe 0.
          </p>
          {sinPunto ? (
            // Sin el punto del local no hay contra qué medir: el asistente
            // cobraría siempre la zona más cara, como estimado.
            <p className="ayuda envio-aviso">
              Tu ficha todavía no tiene su punto en el mapa. Sin él no podemos
              medir la distancia y se cobra la zona más cara.{" "}
              <a href="#direccion">Márcalo en Dirección</a>.
            </p>
          ) : null}
          <div className="envio-tabla" role="group" aria-label="Zonas de envío">
            <span className="envio-cabeza" aria-hidden="true">Hasta (km)</span>
            <span className="envio-cabeza" aria-hidden="true">Envío ($)</span>
            <span className="envio-cabeza" aria-hidden="true">Tarda (min)</span>
            {Array.from({ length: MAX_ZONAS }, (_, i) => (
              <ZonaDeEnvio key={i} i={i} zona={campos.zonas[i]} />
            ))}
          </div>
        </fieldset>
      </div>

      <label className="campo envio-llevar">
        <span>
          Tiempo para llevar, en minutos <em>(opcional)</em>
        </span>
        <input
          type="number"
          name="envio_llevar_minutos"
          min={5}
          max={240}
          inputMode="numeric"
          defaultValue={campos.llevar}
          placeholder="20"
        />
      </label>
    </div>
  );
}

function ZonaDeEnvio({ i, zona }) {
  const n = i + 1;
  return (
    <>
      <label>
        <span className="sr-only">Zona {n}: hasta cuántos kilómetros</span>
        <input
          type="text"
          name={`envio_km_${i}`}
          inputMode="decimal"
          defaultValue={zona.km}
          placeholder={["3", "6", "9"][i]}
        />
      </label>
      <label>
        <span className="sr-only">Zona {n}: costo del envío en pesos</span>
        <input
          type="text"
          name={`envio_costo_${i}`}
          inputMode="decimal"
          defaultValue={zona.costo}
          placeholder={["30", "50", "70"][i]}
        />
      </label>
      <label>
        <span className="sr-only">Zona {n}: minutos que tarda en llegar</span>
        <input
          type="number"
          name={`envio_minutos_${i}`}
          min={5}
          max={240}
          inputMode="numeric"
          defaultValue={zona.minutos}
          placeholder={["35", "50", "60"][i]}
        />
      </label>
    </>
  );
}
