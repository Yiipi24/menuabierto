"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Los dos campos de texto podrían ser un <form method="get"> y funcionarían
// sin JavaScript, pero "Cerca de mí" necesita el navegador de todos modos:
// la ubicación solo la puede pedir el cliente. Se resuelven juntos aquí para
// que ambos caminos conserven los filtros que ya estaban puestos.
export default function Buscador({ q = "", lugar = "", conUbicacion = false, children }) {
  const router = useRouter();
  const params = useSearchParams();
  const [texto, setTexto] = useState(q);
  const [zona, setZona] = useState(lugar);
  const [ubicando, setUbicando] = useState(false);
  const [aviso, setAviso] = useState("");

  function irA(cambios) {
    const siguiente = new URLSearchParams(params.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") siguiente.delete(clave);
      else siguiente.set(clave, valor);
    }
    router.push(`/?${siguiente.toString()}`);
  }

  function buscar(e) {
    e.preventDefault();
    irA({ q: texto.trim(), lugar: zona.trim() });
  }

  function cercaDeMi() {
    if (!navigator.geolocation) {
      setAviso("Tu navegador no comparte la ubicación. Escribe tu colonia o ciudad.");
      return;
    }
    setAviso("");
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicando(false);
        // Cinco decimales son unos cien metros: suficiente para ordenar por
        // cercanía y menos preciso que dejar la casa exacta en la URL.
        irA({
          lat: pos.coords.latitude.toFixed(5),
          lng: pos.coords.longitude.toFixed(5),
          orden: "cercanos",
          lugar: null,
        });
      },
      () => {
        setUbicando(false);
        setAviso("No pudimos obtener tu ubicación. Escribe tu colonia o ciudad.");
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <form className="buscador" onSubmit={buscar}>
      <div className="buscador-campos">
        <label className="buscador-campo">
          <span className="buscador-icono" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5 18 18" />
            </svg>
          </span>
          <input
            type="search"
            name="q"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Restaurante, platillo o tipo de comida"
            aria-label="Restaurante, platillo o tipo de comida"
          />
        </label>

        <label className="buscador-campo">
          <span className="buscador-icono" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M10 18s6-5.2 6-9.6A6 6 0 0 0 4 8.4C4 12.8 10 18 10 18z" />
              <circle cx="10" cy="8.2" r="2.2" />
            </svg>
          </span>
          <input
            type="search"
            name="lugar"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            placeholder="Colonia, zona, municipio/ciudad o estado"
            aria-label="Colonia, zona, municipio, ciudad o estado"
          />
        </label>

        <button className="btn btn-buscar" type="submit">
          Buscar
        </button>
      </div>

      {/* "Cerca de mí" cuelga debajo de la barra: es la tercera forma de lanzar
          la misma búsqueda, y dentro de la barra dejaba un hueco. */}
      <div className="buscador-pie">
        <button
          className={conUbicacion ? "btn-ubicacion btn-ubicacion-on" : "btn-ubicacion"}
          type="button"
          onClick={cercaDeMi}
          disabled={ubicando}
        >
          <span className="btn-ubicacion-icono" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="3.2" />
              <circle cx="10" cy="10" r="6.6" />
              <path d="M10 1v2.2M10 16.8V19M1 10h2.2M16.8 10H19" />
            </svg>
          </span>
          {ubicando ? "Buscando tu ubicación…" : "Cerca de mí"}
        </button>
        {conUbicacion ? (
          <button
            className="buscador-quitar"
            type="button"
            onClick={() => irA({ lat: null, lng: null })}
          >
            Quitar mi ubicación
          </button>
        ) : null}

        {children}
      </div>

      {aviso ? (
        <p className="buscador-aviso" role="status">
          {aviso}
        </p>
      ) : null}
    </form>
  );
}
