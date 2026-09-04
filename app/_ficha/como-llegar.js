"use client";

import { useEffect, useRef, useState } from "react";
import { medir } from "../medir";
import { IconoCompartir } from "./iconos";

// "Cómo llegar" abría Google Maps y punto. En México media ciudad navega con
// Waze, y a quien lo usa el botón le costaba dos pasos más: abrir Maps, copiar
// la dirección y pegarla en la otra app. Ahora el botón pregunta.
//
// Las dos opciones se abren por dirección de texto y no por coordenadas: es lo
// que la ficha tiene publicado, y las dos apps la resuelven igual. Los dos
// clics cuentan como el mismo `directions_click`: para el dueño lo que importa
// es cuánta gente pidió el camino, no con qué app lo hizo.

const APPS = [
  {
    id: "maps",
    nombre: "Google Maps",
    url: (consulta) =>
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`,
  },
  {
    id: "waze",
    nombre: "Waze",
    // `navigate=yes` arranca la ruta en cuanto Waze abre, en vez de dejar el
    // lugar puesto en el buscador esperando otro toque.
    url: (consulta) => `https://waze.com/ul?q=${encodeURIComponent(consulta)}&navigate=yes`,
  },
];

function IconoMaps({ ancho = 20 }) {
  return (
    <svg width={ancho} height={ancho} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z"
        fill="#34a853"
      />
      <path d="M12 2a7 7 0 0 0-6.1 3.6L12 12l6.1-6.4A7 7 0 0 0 12 2z" fill="#4285f4" />
      <circle cx="12" cy="9" r="2.7" fill="#ffffff" />
    </svg>
  );
}

function IconoWaze({ ancho = 20 }) {
  return (
    <svg width={ancho} height={ancho} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3c4.4 0 8 3 8 6.9 0 3.6-2.6 5.9-6 6.6-.8.2-1.3.5-1.8 1-.7.8-1.7 1.3-2.8 1.3H7.6l.9-2.1C5.9 15.5 4 12.9 4 9.9 4 6 7.6 3 12 3z"
        fill="#33ccff"
      />
      <circle cx="9.6" cy="9.2" r="1.05" fill="#ffffff" />
      <circle cx="14.4" cy="9.2" r="1.05" fill="#ffffff" />
      <path
        d="M9.4 12.2c.6.8 1.5 1.2 2.6 1.2s2-.4 2.6-1.2"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ICONOS = { maps: IconoMaps, waze: IconoWaze };

export default function ComoLlegar({ slug, nombre, direccion }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  // Un menú que solo se cierra con su propio botón se queda abierto encima del
  // menú del restaurante en cuanto la persona toca otra cosa.
  useEffect(() => {
    if (!abierto) return undefined;

    function fuera(evento) {
      if (!caja.current?.contains(evento.target)) setAbierto(false);
    }
    function escape(evento) {
      if (evento.key === "Escape") setAbierto(false);
    }

    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const consulta = `${nombre} ${direccion}`;

  return (
    <div className="ficha-comollegar" ref={caja}>
      <button
        type="button"
        className="btn ficha-banda-boton"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
      >
        <IconoCompartir ancho={19} />
        Cómo llegar
      </button>

      {abierto ? (
        <div className="ficha-comollegar-menu" role="menu">
          <p className="ficha-comollegar-titulo">Abrir con</p>
          {APPS.map((app) => {
            const Icono = ICONOS[app.id];
            return (
              <a
                key={app.id}
                role="menuitem"
                className="ficha-comollegar-opcion"
                href={app.url(consulta)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  medir(slug, "directions_click");
                  setAbierto(false);
                }}
              >
                <Icono ancho={22} />
                {app.nombre}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
