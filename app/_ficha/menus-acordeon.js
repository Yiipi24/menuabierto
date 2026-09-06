"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { IconoFlecha, IconoChevron } from "./iconos";
import QrDescarga from "./qr-descarga";

// La lista de cartas de la ficha. Antes había un solo bloque con un botón y un
// QR para todo el restaurante; con varias cartas eso no alcanzaba, porque el
// QR de la barra y el de la mesa no son el mismo código.
//
// Es un acordeón y no cuatro bloques abiertos porque un restaurante con cuatro
// cartas empujaría los horarios y el contacto fuera de la pantalla. Abierta
// queda la primera: es la principal y la que casi siempre se busca.
//
// El QR llega pintado desde el servidor —en `carta.qr`— para no bajar al
// navegador la librería que lo dibuja: son cuatro códigos que no cambian nunca
// mientras la página está abierta.
export default function MenusAcordeon({ cartas }) {
  const base = useId();
  const [abierta, setAbierta] = useState(cartas[0]?.id ?? null);

  return (
    <ul className="menu-acordeon">
      {cartas.map((carta) => {
        const abierto = carta.id === abierta;
        const panel = `${base}-${carta.id}`;

        return (
          <li className={`menu-acordeon-fila${abierto ? " abierta" : ""}`} key={carta.id}>
            {/* Toda la fila es el botón, no solo el chevron: en un teléfono,
                atinarle a una flecha de 20 píxeles es pedir demasiado. */}
            <button
              type="button"
              className="menu-acordeon-cabeza"
              aria-expanded={abierto}
              aria-controls={panel}
              onClick={() => setAbierta(abierto ? null : carta.id)}
            >
              <span className="menu-acordeon-icono" aria-hidden="true">
                {carta.icono}
              </span>
              <span className="menu-acordeon-texto">
                <span className="menu-acordeon-nombre">{carta.nombre}</span>
                {carta.descripcion ? (
                  <span className="menu-acordeon-resumen">{carta.descripcion}</span>
                ) : null}
              </span>
              <span className="menu-acordeon-chevron" aria-hidden="true">
                <IconoChevron ancho={20} />
              </span>
            </button>

            {/* `hidden` y no desmontar: el panel cerrado no se pinta, pero el
                QR ya viene del servidor y volver a montarlo en cada clic haría
                parpadear la imagen. */}
            <div className="menu-acordeon-panel" id={panel} hidden={!abierto}>
              <Link className="btn menu-acordeon-boton" href={carta.href}>
                Ver menú
                <IconoFlecha ancho={19} />
              </Link>

              <QrDescarga nombreArchivo={carta.nombreArchivo}>
                <div className="menu-acordeon-qr">{carta.qr}</div>
              </QrDescarga>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
