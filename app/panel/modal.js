"use client";

import { useEffect, useRef } from "react";
import { IconoEquis } from "./tablero-iconos";

/**
 * El diálogo del panel.
 *
 * Va sobre el `<dialog>` del navegador y no sobre un div con `position:
 * fixed`: el elemento nativo ya trae el foco atrapado dentro, el fondo
 * inerte, el cierre con Escape y el papel de `role="dialog"`. Escribir eso a
 * mano son cincuenta líneas que además se equivocan.
 *
 * Lo único que hay que agregarle es el clic en el fondo, que el nativo no
 * cierra, y el `close` de Escape, que hay que devolverle a React.
 */
export default function Modal({ abierto, alCerrar, titulo, descripcion, children }) {
  const dialogo = useRef(null);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  if (!abierto) return null;

  return (
    <dialog
      className="modal"
      ref={dialogo}
      onClose={alCerrar}
      // El backdrop es parte del propio <dialog>, así que un clic en él llega
      // aquí con el diálogo como blanco. Lo de dentro va en un <div>, que es
      // lo que distingue "afuera" de "adentro".
      onClick={(e) => {
        if (e.target === dialogo.current) alCerrar();
      }}
    >
      <div className="modal-caja">
        <div className="modal-cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="modal-cerrar" onClick={alCerrar} aria-label="Cerrar">
            <IconoEquis ancho={18} />
          </button>
        </div>
        {descripcion ? <p className="modal-texto">{descripcion}</p> : null}
        {children}
      </div>
    </dialog>
  );
}
