"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { pesos } from "../../../../lib/precios";
import { cuentaDe, estadoDePedido, lineasGuardadas, pedidoAbierto, siguientesEstados } from "../../../../lib/pedidos";
import { hace } from "../../../../lib/social";
import { enlaceWhatsapp, entregaDe, renglonDePedido, telefonoLegible } from "../../../../lib/whatsapp";
import { IconoRed } from "../../../redes-iconos";
import { cambiarEstadoPedido } from "./actions";

// Cada cuánto se vuelve a preguntar si llegó algo. Veinte segundos es menos
// de lo que tarda alguien en contestar un WhatsApp a mano, y el refresco solo
// corre con la pestaña a la vista.
const REFRESCO_MS = 20_000;

const inicial = { status: "idle", message: "" };

function useRefresco() {
  const router = useRouter();
  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const intervalo = setInterval(refrescar, REFRESCO_MS);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [router]);
}

// "(2) Pedidos": lo que se ve en la pestaña cuando la pantalla está detrás
// de otra.
function useTitulo(nuevos) {
  useEffect(() => {
    document.title = nuevos ? `(${nuevos}) Pedidos — Menú Abierto` : "Pedidos — Menú Abierto";
  }, [nuevos]);
}

// A dónde se lleva: el punto que compartió el cliente, o la dirección escrita.
function mapaDe(pedido) {
  if (pedido.lat != null && pedido.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${pedido.lat},${pedido.lng}`;
  }
  return pedido.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pedido.address)}`
    : null;
}

function TarjetaPedido({ id, pedido }) {
  const [estado, accion, pendiente] = useActionState(cambiarEstadoPedido, inicial);
  const lineas = lineasGuardadas(pedido.items);
  const cuenta = cuentaDe(lineas);
  const entrega = entregaDe(pedido.delivery);
  const mapa = pedido.delivery === "domicilio" ? mapaDe(pedido) : null;
  const abierto = pedidoAbierto(pedido.status);
  const moneda = pedido.currency || "MXN";

  return (
    <li className={`pedido-tarjeta es-${pedido.status}`}>
      <header className="pedido-cabeza">
        <span className="pedido-codigo">{pedido.code}</span>
        <span className={`estado pedido-estado es-${pedido.status}`}>{estadoDePedido(pedido.status)?.nombre}</span>
        <span className="pedido-hace" suppressHydrationWarning>
          {hace(pedido.created_at)}
        </span>
      </header>

      <div className="pedido-cliente">
        <strong>{pedido.customer_name || "Cliente"}</strong>
        {pedido.customer_phone ? (
          <a
            className="pedido-chat"
            href={enlaceWhatsapp(pedido.customer_phone)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconoRed slug="whatsapp" ancho={16} />
            {telefonoLegible(pedido.customer_phone)}
          </a>
        ) : null}
      </div>

      {entrega ? (
        <p className="pedido-entrega">
          <strong>{entrega.nombre}</strong>
          {pedido.delivery === "domicilio" ? (
            <>
              {" · "}
              {pedido.address || "Ubicación compartida"}
              {mapa ? (
                <>
                  {" · "}
                  <a href={mapa} target="_blank" rel="noopener noreferrer">
                    Ver en el mapa
                  </a>
                </>
              ) : null}
            </>
          ) : null}
        </p>
      ) : null}

      {lineas.length ? (
        <ul className="pedido-platillos">
          {lineas.map((l, i) => (
            <li key={`${l.id ?? l.nombre}-${i}`}>{renglonDePedido(l, moneda).replace(/^• /, "")}</li>
          ))}
        </ul>
      ) : null}
      {pedido.details ? <p className="pedido-libre">&ldquo;{pedido.details}&rdquo;</p> : null}

      {cuenta.alguno ? (
        <p className="pedido-total">
          Total aproximado: <strong>{pesos(pedido.total_cents ?? cuenta.total, moneda)}</strong>
          {cuenta.completo ? null : <span> (hay platillos sin precio)</span>}
        </p>
      ) : null}
      {pedido.notes ? <p className="pedido-nota">Nota: {pedido.notes}</p> : null}

      {abierto ? (
        <div className="pedido-acciones">
          {siguientesEstados(pedido.status).map((s) => (
            <form action={accion} key={s}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="pedido" value={pedido.id} />
              <input type="hidden" name="estado" value={s} />
              <button
                type="submit"
                className={s === "cancelado" ? "btn-texto" : "btn btn-sm"}
                disabled={pendiente}
                onClick={
                  s === "cancelado"
                    ? (e) => {
                        if (!window.confirm(`¿Cancelar el pedido ${pedido.code}? Le avisamos al cliente.`)) {
                          e.preventDefault();
                        }
                      }
                    : undefined
                }
              >
                {estadoDePedido(s)?.boton}
              </button>
            </form>
          ))}
        </div>
      ) : null}

      {/* "aviso" es que el pedido sí cambió pero al cliente no le llegó el
          mensaje: no se pinta como error, o el dueño volvería a tocar el botón
          de algo que ya hizo. */}
      {estado.message ? (
        <p
          className={`form-msg ${estado.status === "error" ? "err" : estado.status}`}
          role={estado.status === "error" ? "alert" : "status"}
        >
          {estado.message}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Los pedidos, en una sola lista: primero los abiertos del más viejo al más
 * nuevo, luego los cerrados del día. Es una lista y no tres columnas a
 * propósito: la tarjeta de un pedido que cambia de estado se queda donde está
 * montada, y con ella el mensaje de si al cliente le llegó el aviso.
 */
export function ListaPedidos({ id, pedidos, conectado }) {
  const nuevos = pedidos.filter((p) => p.status === "nuevo").length;
  useRefresco();
  useTitulo(nuevos);

  if (!pedidos.length) {
    return (
      <div className="vacio">
        <h2>No hay pedidos por ahora</h2>
        <p>
          {conectado
            ? "Cuando alguien pida por WhatsApp, su pedido aparece aquí sin recargar la página. Déjala abierta en el mostrador."
            : "Cuando el asistente esté conectado, los pedidos aparecen aquí."}
        </p>
      </div>
    );
  }

  return (
    <ul className="pedidos-lista" aria-live="polite">
      {pedidos.map((p) => (
        <TarjetaPedido key={p.id} id={id} pedido={p} />
      ))}
    </ul>
  );
}
