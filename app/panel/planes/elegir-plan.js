"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { continuarConElPago } from "./actions";
import {
  IconoCalendario,
  IconoCandado,
  IconoFlecha,
  IconoPalomita,
  IconoTarjeta,
} from "../tablero-iconos";

// Elegir plan y forma de pago de una ficha, con el resumen al lado. Lo que se
// puede elegir lo decide la página en el servidor —las mismas reglas que
// comprueban las acciones—; aquí solo se recuerda la elección para pintar el
// resumen. El formulario usa radios y un <select> de verdad, y la acción
// (`continuarConElPago`) los lee tal cual.
//
// No se preselecciona ningún plan: "recomendado" es una sugerencia de la
// tabla de planes, no una compra a medio hacer.
export default function ElegirPlan({ restaurante, planes, cobroActivo, notaSubir, ordenVigente }) {
  const [planElegido, setPlanElegido] = useState(null);
  const [modo, setModo] = useState(null);
  const [meses, setMeses] = useState(null);

  const plan = planes.find((p) => p.slug === planElegido) ?? null;
  const adelanto = plan?.adelantos.find((a) => a.meses === meses) ?? plan?.adelantos[0] ?? null;

  function elegirPlan(slug) {
    const nuevo = planes.find((p) => p.slug === slug);
    setPlanElegido(slug);
    // Con una sola forma de pagar disponible, se elige sola; con las dos, se
    // conserva la que ya estaba si el plan nuevo también la tiene.
    const formas = [nuevo.mensual ? "mensual" : null, nuevo.adelantos.length ? "adelanto" : null].filter(Boolean);
    setModo((actual) => (formas.length === 1 ? formas[0] : formas.includes(actual) ? actual : null));
    setMeses((actual) => (nuevo.adelantos.some((a) => a.meses === actual) ? actual : nuevo.adelantos[0]?.meses ?? null));
  }

  const listo = Boolean(plan && (modo === "mensual" ? plan.mensual : modo === "adelanto" && adelanto));
  const sube = plan && modo === "adelanto" && notaSubir && plan.orden > ordenVigente;

  return (
    <form action={continuarConElPago} className="elegir-plan">
      <input type="hidden" name="restaurante" value={restaurante.id} />

      <div className="elegir-pasos">
        <fieldset className="elegir-paso">
          <legend className="elegir-paso-titulo">
            <span className="elegir-paso-numero" aria-hidden="true">1</span>
            <span>
              Elige un plan
              <small>Cambia o mejora el plan de este restaurante.</small>
            </span>
          </legend>
          <div className="opciones-plan">
            {/* Todos se pueden elegir, aunque hoy no se puedan pagar: el paso 2
                dice por qué, que es más útil que un botón apagado sin razón. */}
            {planes.map((p) => {
              const elegido = planElegido === p.slug;
              return (
                <label key={p.slug} className={`opcion-plan${elegido ? " opcion-elegida" : ""}`}>
                  <input
                    type="radio"
                    name="plan"
                    value={p.slug}
                    checked={elegido}
                    onChange={() => elegirPlan(p.slug)}
                  />
                  <span className="opcion-plan-nombre">
                    {p.nombre}
                    {elegido ? <IconoPalomita ancho={16} /> : null}
                  </span>
                  <span className="opcion-plan-precio">{p.precioMensual} al mes</span>
                  {p.actual ? <span className="opcion-plan-nota">Tu plan actual</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="elegir-paso" disabled={!plan}>
          <legend className="elegir-paso-titulo">
            <span className="elegir-paso-numero" aria-hidden="true">2</span>
            <span>
              Elige cómo pagar
              <small>{plan ? `Para el plan ${plan.nombre}.` : "Primero elige un plan."}</small>
            </span>
          </legend>
          <div className="opciones-pago">
            <label
              className={`opcion-pago${modo === "mensual" ? " opcion-elegida" : ""}${plan && !plan.mensual ? " opcion-apagada" : ""}`}
            >
              <input
                type="radio"
                name="modo"
                value="mensual"
                checked={modo === "mensual"}
                disabled={!plan?.mensual}
                onChange={() => setModo("mensual")}
              />
              <span className="opcion-pago-icono">
                <IconoTarjeta ancho={20} />
              </span>
              <span className="opcion-pago-texto">
                <strong>Cada mes con tarjeta</strong>
                <span>
                  {plan && !plan.mensual
                    ? plan.sinMensual
                    : "Cobro automático con tarjeta de crédito o débito. Cancelas cuando quieras."}
                </span>
              </span>
            </label>

            <label
              className={`opcion-pago${modo === "adelanto" ? " opcion-elegida" : ""}${plan && !plan.adelantos.length ? " opcion-apagada" : ""}`}
            >
              <input
                type="radio"
                name="modo"
                value="adelanto"
                checked={modo === "adelanto"}
                disabled={!plan?.adelantos.length}
                onChange={() => setModo("adelanto")}
              />
              <span className="opcion-pago-icono">
                <IconoCalendario ancho={20} />
              </span>
              <span className="opcion-pago-texto">
                <strong>Por adelantado</strong>
                <span>
                  {plan && !plan.adelantos.length
                    ? plan.sinAdelanto
                    : "De 1 a 12 meses en un solo pago: OXXO, SPEI, saldo de Mercado Pago o tarjeta."}
                </span>
              </span>
            </label>
          </div>

          {modo === "adelanto" && plan?.adelantos.length ? (
            <label className="elegir-meses">
              <span>¿Cuántos meses?</span>
              <select
                name="meses"
                value={adelanto?.meses ?? ""}
                onChange={(e) => setMeses(Number(e.target.value))}
              >
                {plan.adelantos.map((a) => (
                  <option key={a.meses} value={a.meses}>
                    {a.etiqueta} · {a.total}
                    {a.sinOxxo ? " · sin OXXO" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>
      </div>

      <aside className="resumen-pago" aria-live="polite">
        <h3>Resumen de tu selección</h3>
        <dl>
          <div>
            <dt>Restaurante</dt>
            <dd>{restaurante.nombre}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{plan ? plan.nombre : "—"}</dd>
          </div>
          <div>
            <dt>Forma de pago</dt>
            <dd>
              {modo === "mensual"
                ? "Cada mes con tarjeta"
                : modo === "adelanto" && adelanto
                  ? `Por adelantado · ${adelanto.etiqueta}`
                  : "—"}
            </dd>
          </div>
          <div className="resumen-total">
            <dt>{modo === "adelanto" ? "Total" : "Precio"}</dt>
            <dd>
              {listo ? (
                <>
                  <strong>{modo === "mensual" ? plan.precioMensual : adelanto.total}</strong>
                  <span>
                    {restaurante.moneda} {modo === "mensual" ? "al mes" : "en un solo pago"}
                  </span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>

        {!plan ? <p className="resumen-nota">Elige un plan y cómo pagarlo para ver el total.</p> : null}
        {plan && !modo ? <p className="resumen-nota">Elige cómo quieres pagar.</p> : null}
        {modo === "adelanto" && adelanto?.sinOxxo ? (
          <p className="resumen-nota">
            Pasa del tope de OXXO ({restaurante.topeOxxo}): se paga por SPEI, con saldo o con tarjeta.
          </p>
        ) : null}
        {sube ? <p className="resumen-nota">{notaSubir}</p> : null}

        <BotonPagar listo={listo} cobroActivo={cobroActivo} />

        {!cobroActivo ? (
          <p className="resumen-nota">El cobro aún no está habilitado.</p>
        ) : (
          <p className="resumen-seguro">
            <IconoCandado ancho={16} />
            {modo === "mensual"
              ? "Pago seguro con Mercado Pago, con tarjeta de crédito o débito."
              : "Pago seguro con Mercado Pago: tarjeta, OXXO, SPEI o saldo."}
          </p>
        )}
      </aside>
    </form>
  );
}

// El botón se apaga mientras la acción crea el pago: un segundo clic crearía
// otro en la pasarela.
function BotonPagar({ listo, cobroActivo }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn resumen-boton" type="submit" disabled={!listo || !cobroActivo || pending}>
      {pending ? "Te llevamos a Mercado Pago…" : "Continuar con el pago"}
      {pending ? null : <IconoFlecha ancho={18} />}
    </button>
  );
}
