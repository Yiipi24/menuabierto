"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { pesos } from "../../lib/precios";
import { enlaceWhatsapp, mensajeDePedido } from "../../lib/whatsapp";
import { medir } from "../medir";
import { IconoRed } from "../redes-iconos";

// El pedido por WhatsApp, del lado del comensal.
//
// No hay carrito guardado ni orden en la base: quien pide toca los platillos
// de la carta, y al final el sitio escribe el mensaje y abre el chat del
// restaurante. Lo que se manda es texto, y quien lo confirma y lo cobra es el
// local. Un pedido a medias que nadie contestó no puede quedar "pendiente" en
// ningún lado, porque no existe en ningún lado.
//
// El estado vive en la página y se va con ella a propósito: nadie vuelve al
// día siguiente a terminar de pedir unos tacos, y guardarlo obligaría a
// preguntarse qué hacer cuando el precio del platillo ya cambió.

const Contexto = createContext(null);

/**
 * Envuelve la carta. Sin `pedidos` —el restaurante no toma pedidos por
 * WhatsApp, o es la vista previa del panel— el contexto queda apagado y los
 * botones de "agregar" no se pintan: la carta se ve exactamente como antes.
 */
export function PedidoProvider({ pedidos, nombre, slug, url, children }) {
  // La llave es el id del platillo y el valor lo que se sabe de él: la
  // cantidad y lo que hay que escribir en el mensaje. Guardar el nombre y el
  // precio aquí evita tener que volver a recorrer la carta para armarlo.
  const [lineas, setLineas] = useState(() => new Map());
  // Cómo lo quiere: para aquí, para llevar o a domicilio. Con una sola opción
  // no hay nada que elegir y se manda esa; con varias, la primera va marcada
  // para que quien tiene prisa no tenga que tocar nada más.
  const [entrega, setEntrega] = useState(() => pedidos?.entregas?.[0]?.slug ?? null);

  const cambiar = useCallback((platillo, delta) => {
    setLineas((antes) => {
      const ahora = new Map(antes);
      const previa = ahora.get(platillo.id);
      const cantidad = (previa?.cantidad ?? 0) + delta;
      if (cantidad <= 0) {
        ahora.delete(platillo.id);
        return ahora;
      }
      ahora.set(platillo.id, {
        cantidad,
        nombre: platillo.name,
        precio: platillo.price_cents ?? null,
        moneda: platillo.currency || "MXN",
      });
      return ahora;
    });
  }, []);

  const valor = useMemo(() => {
    if (!pedidos) return null;
    const lista = [...lineas.values()];
    return {
      nombre,
      slug,
      url,
      pedidos,
      lineas,
      lista,
      piezas: lista.reduce((suma, l) => suma + l.cantidad, 0),
      total: lista.reduce((suma, l) => suma + (l.precio ?? 0) * l.cantidad, 0),
      // El total solo se enseña cuando todo lo elegido trae precio: sumar los
      // que sí lo traen y callar los que no daría una cuenta más barata que la
      // de verdad, y eso se lee como una promesa.
      totalCompleto: lista.length > 0 && lista.every((l) => l.precio != null),
      moneda: lista.find((l) => l.moneda)?.moneda ?? "MXN",
      entrega,
      entregas: pedidos.entregas ?? [],
      elegirEntrega: setEntrega,
      cambiar,
      vaciar: () => setLineas(new Map()),
    };
  }, [pedidos, nombre, slug, url, lineas, cambiar, entrega]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePedido() {
  return useContext(Contexto);
}

/**
 * El control de un platillo dentro de la carta: un "+" mientras no se ha
 * pedido, y la cuenta con sus dos botones en cuanto se pide uno.
 *
 * Devuelve `null` cuando no hay pedidos —la mayoría de las cartas— así que
 * `menu-render` lo puede poner siempre sin preguntar nada.
 */
export function BotonAgregar({ platillo }) {
  const pedido = usePedido();
  // Un platillo agotado no se puede pedir. Enseñar su botón sería ofrecer algo
  // que la cocina ya dijo que no tiene.
  if (!pedido || platillo?.is_available === false) return null;

  const cantidad = pedido.lineas.get(platillo.id)?.cantidad ?? 0;

  if (!cantidad) {
    return (
      <button
        type="button"
        className="menu-pedir"
        onClick={() => pedido.cambiar(platillo, 1)}
        aria-label={`Agregar ${platillo.name} al pedido`}
      >
        <span aria-hidden="true">+</span>
      </button>
    );
  }

  return (
    <span className="menu-pedir-cuenta">
      <button
        type="button"
        onClick={() => pedido.cambiar(platillo, -1)}
        aria-label={`Quitar uno de ${platillo.name}`}
      >
        <span aria-hidden="true">−</span>
      </button>
      <output aria-label={`${cantidad} de ${platillo.name}`}>{cantidad}</output>
      <button
        type="button"
        onClick={() => pedido.cambiar(platillo, 1)}
        aria-label={`Agregar otro ${platillo.name}`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </span>
  );
}

/**
 * La barra de abajo. Aparece cuando hay algo elegido y no antes: una barra
 * vacía flotando sobre la carta le quita a la carta el espacio que necesita.
 */
export function BarraPedido() {
  const pedido = usePedido();
  if (!pedido || !pedido.lista.length) return null;

  const { piezas, total, totalCompleto, moneda, entregas, entrega } = pedido;
  const mensaje = mensajeDePedido({
    nombre: pedido.nombre,
    url: pedido.url,
    lineas: pedido.lista,
    moneda,
    entrega,
  });

  return (
    <div className="pedido-barra" role="region" aria-label="Tu pedido">
      {entregas.length > 1 ? (
        <div className="pedido-entrega" role="radiogroup" aria-label="¿Cómo lo quieres?">
          {entregas.map((e) => (
            <button
              key={e.slug}
              type="button"
              role="radio"
              aria-checked={entrega === e.slug}
              className={entrega === e.slug ? "pedido-entrega-opcion es-elegida" : "pedido-entrega-opcion"}
              onClick={() => pedido.elegirEntrega(e.slug)}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      ) : null}

      <div className="pedido-barra-dentro">
        <div className="pedido-barra-cuenta">
          <strong>
            {piezas} {piezas === 1 ? "platillo" : "platillos"}
          </strong>
          <span>
            {totalCompleto ? pesos(total, moneda) : "Precio a confirmar"}
          </span>
        </div>

        <div className="pedido-barra-acciones">
          <button type="button" className="btn-texto" onClick={pedido.vaciar}>
            Vaciar
          </button>
          <a
            className="btn btn-whatsapp"
            href={enlaceWhatsapp(pedido.pedidos.telefono, mensaje)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => medir(pedido.slug, "whatsapp_order")}
          >
            <IconoRed slug="whatsapp" ancho={20} />
            Enviar por WhatsApp
          </a>
        </div>
      </div>

      {pedido.pedidos.nota ? (
        <p className="pedido-barra-nota">{pedido.pedidos.nota}</p>
      ) : null}
    </div>
  );
}

/**
 * El aviso de arriba de la carta: dice que se puede pedir desde aquí antes de
 * que alguien descubra el primer "+" por accidente.
 */
export function AvisoPedido({ conPlatillos = true }) {
  const pedido = usePedido();
  if (!pedido) return null;

  return (
    <p className="pedido-aviso">
      <span className="pedido-aviso-logo">
        <IconoRed slug="whatsapp" ancho={18} />
      </span>
      <span>
        <strong>Puedes pedir por WhatsApp.</strong>{" "}
        {conPlatillos
          ? "Toca el + de cada platillo y te armamos el mensaje."
          : "Abre el chat y dinos qué se te antoja."}
        {pedido.pedidos.nota ? ` ${pedido.pedidos.nota}` : ""}
      </span>
    </p>
  );
}

/**
 * El botón suelto, para donde no hay platillos que elegir: la ficha y las
 * cartas de archivo (un PDF o una foto no se pueden tocar platillo por
 * platillo). Manda el mensaje a medias y quien pide escribe el resto.
 */
export function BotonPedirWhatsapp({ telefono, mensaje, slug, clase = "btn btn-whatsapp" }) {
  return (
    <a
      className={clase}
      href={enlaceWhatsapp(telefono, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => medir(slug, "whatsapp_click")}
    >
      <IconoRed slug="whatsapp" ancho={20} />
      Pedir por WhatsApp
    </a>
  );
}
