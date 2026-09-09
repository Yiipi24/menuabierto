"use client";

import Link from "next/link";
import { useState } from "react";
import Modal from "../panel/modal";
import { pesos } from "../../lib/precios";
import { rutaMenuCarta } from "../../lib/slug";
import { IconoChevron, IconoFlecha } from "./iconos";

// "Favoritos de la casa": las fotos grandes bajo el encabezado.
//
// Cada foto abre un visor con lo que el dueño escribió de ella —nombre,
// etiqueta, descripción— y, si la colgó de un platillo de su carta, el precio
// y el camino al menú. Una foto sin nombre se enseña igual, sin franja: las
// que se subieron antes de que existieran los nombres no se ven peor por eso.
//
// En escritorio son tres de lado a lado; en tablet y teléfono la misma lista
// se vuelve un carrusel que se desliza con el dedo, sin cambiar el HTML.

function Precio({ foto }) {
  if (foto.precio === null || foto.precio === undefined) return null;
  return <span className="fx-favorito-precio">{pesos(foto.precio, foto.moneda || "MXN")}</span>;
}

export default function Favoritos({ slug, nombre, fotos, hayMenu, hrefMenu }) {
  const [abierta, setAbierta] = useState(null);

  if (!fotos.length) return null;

  const enlaceMenu = (f) => (f.menuId ? rutaMenuCarta(slug, f.menuId) : null);

  return (
    <section className="fx-favoritos" id="platillos" aria-labelledby="fx-favoritos-titulo">
      <div className="wrap wrap-ficha">
        <header className="fx-seccion-cabeza">
          <h2 id="fx-favoritos-titulo" className="fx-seccion-titulo">
            <span className="fx-seccion-marca" aria-hidden="true">
              <IconoLlama ancho={26} />
            </span>
            Favoritos de la casa
          </h2>
          {hayMenu ? (
            <Link className="fx-seccion-enlace" href={hrefMenu}>
              Ver todos los platillos
              <IconoFlecha ancho={17} />
            </Link>
          ) : null}
        </header>

        <ul className="fx-favoritos-lista">
          {fotos.map((f) => (
            <li key={f.id} className="fx-favorito">
              <button
                type="button"
                className="fx-favorito-boton"
                onClick={() => setAbierta(f)}
                aria-label={
                  f.dishName ? `Ver ${f.dishName}` : `Ver foto ${f.alt ? `de ${f.alt}` : "del platillo"}`
                }
              >
                <img src={f.url} alt={f.alt ?? f.dishName ?? ""} loading="lazy" />
                {f.dishName ? (
                  <span className="fx-favorito-franja">
                    <span className="fx-favorito-texto">
                      {f.dishLabel ? <span className="fx-favorito-etiqueta">{f.dishLabel}</span> : null}
                      <span className="fx-favorito-nombre">{f.dishName}</span>
                    </span>
                    <span className="fx-favorito-chevron" aria-hidden="true">
                      <IconoChevron ancho={20} />
                    </span>
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Modal
        abierto={Boolean(abierta)}
        alCerrar={() => setAbierta(null)}
        titulo={abierta?.dishName ?? `Foto de ${nombre}`}
      >
        {abierta ? (
          <div className="fx-favorito-visor">
            <img src={abierta.url} alt={abierta.alt ?? abierta.dishName ?? ""} />
            <div className="fx-favorito-visor-datos">
              {abierta.dishLabel ? (
                <span className="fx-favorito-etiqueta">{abierta.dishLabel}</span>
              ) : null}
              <Precio foto={abierta} />
              {abierta.description ? (
                <p className="fx-favorito-descripcion">{abierta.description}</p>
              ) : null}
              {enlaceMenu(abierta) ? (
                <Link className="btn btn-sm" href={enlaceMenu(abierta)}>
                  Ver en el menú
                  <IconoFlecha ancho={17} />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

// La llamita de la sección, hermana de la de "Estilo Texas" del encabezado.
function IconoLlama({ ancho = 24 }) {
  return (
    <svg
      className="icono"
      width={ancho}
      height={ancho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5.2 1.2.8 2 1.5 2.5C11.5 8 11 5.5 12 3z" />
      <path d="M5 20h14" />
    </svg>
  );
}
