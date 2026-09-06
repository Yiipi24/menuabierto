"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { IconoFlecha, IconoChevron } from "./iconos";

// La lista de cartas de la ficha.
//
// Es un acordeón y no cuatro bloques abiertos porque un restaurante con cuatro
// cartas empujaría los horarios y el contacto fuera de la pantalla. Abierta
// queda la primera: es la principal y la que casi siempre se busca.
//
// Aquí ya no hay códigos QR. El del restaurante es uno solo, abre esta misma
// ficha y lo imprime el dueño desde su panel: enseñárselo a quien ya está en
// la página no le sirve de nada.
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

            {/* `hidden` y no desmontar: el panel cerrado no se pinta, pero
                conserva su estado y no vuelve a montarse en cada clic. */}
            <div className="menu-acordeon-panel" id={panel} hidden={!abierto}>
              <Link className="btn menu-acordeon-boton" href={carta.href}>
                Ver menú
                <IconoFlecha ancho={19} />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
