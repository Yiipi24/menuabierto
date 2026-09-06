"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { IconoFlecha, IconoChevron } from "./iconos";

// La lista de cartas de la ficha.
//
// Antes cada carta era una fila plegable y el botón "Ver menú" vivía dentro del
// panel que se abría: dos clics para llegar a lo que se vino a ver. Ahora el
// que se pliega es el bloque entero —su chevron está en el encabezado de la
// sección, a la derecha— y cada carta enseña su botón en su propia fila. Un
// restaurante con cuatro cartas sigue pudiendo plegarlas todas de un golpe para
// que no empujen los horarios fuera de la pantalla, y quien tiene una sola
// llega a ella con un clic.
//
// Aquí no hay códigos QR. El del restaurante es uno solo, abre esta misma
// ficha y lo imprime el dueño desde su panel: enseñárselo a quien ya está en la
// página no le sirve de nada.
export default function MenusAcordeon({ cartas, titulo, pista, icono, nota }) {
  const panel = useId();
  const [abierto, setAbierto] = useState(true);

  return (
    <>
      {/* Toda la cabecera es el botón, no solo el chevron: en un teléfono,
          atinarle a una flecha de 20 píxeles es pedir demasiado. */}
      <button
        type="button"
        className="ficha-menu-texto ficha-menu-cabeza"
        aria-expanded={abierto}
        aria-controls={panel}
        onClick={() => setAbierto((a) => !a)}
      >
        <span className="ficha-menu-icono" aria-hidden="true">
          {icono}
        </span>
        <span className="ficha-menu-titulo">
          <h2>{titulo}</h2>
          {pista ? <span>{pista}</span> : null}
        </span>
        <span
          className={abierto ? "ficha-menu-chevron abierto" : "ficha-menu-chevron"}
          aria-hidden="true"
        >
          <IconoChevron ancho={20} />
        </span>
      </button>

      {/* `hidden` y no desmontar: el panel cerrado no se pinta, pero conserva
          su estado y no vuelve a montarse en cada clic. */}
      <div className="ficha-menu-panel" id={panel} hidden={!abierto}>
        <ul className="menu-lista">
          {cartas.map((carta) => (
            <li className="menu-fila" key={carta.id}>
              <span className="menu-fila-icono" aria-hidden="true">
                {carta.icono}
              </span>
              <span className="menu-fila-texto">
                <span className="menu-fila-nombre">{carta.nombre}</span>
                {carta.descripcion ? (
                  <span className="menu-fila-resumen">{carta.descripcion}</span>
                ) : null}
              </span>
              {/* El botón al extremo derecho de su fila: es el destino de la
                  fila entera y ahí es donde la vista lo busca. */}
              <Link className="btn menu-fila-boton" href={carta.href}>
                Ver menú
                <IconoFlecha ancho={19} />
              </Link>
            </li>
          ))}
        </ul>

        {nota}
      </div>
    </>
  );
}
