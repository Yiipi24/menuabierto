"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Los dos campos de texto podrían ser un <form method="get"> y funcionarían
// sin JavaScript, pero "Cerca de mí" necesita el navegador de todos modos:
// la ubicación solo la puede pedir el cliente. Se resuelven juntos aquí para
// que ambos caminos conserven los filtros que ya estaban puestos.
export default function Buscador({ q = "", lugar = "", conUbicacion = false }) {
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
    router.push(`/explorar?${siguiente.toString()}`);
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
          <span aria-hidden="true">⌕</span>
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
          <span aria-hidden="true">◎</span>
          <input
            type="search"
            name="lugar"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            placeholder="Colonia, zona, municipio/ciudad o estado"
            aria-label="Colonia, zona, municipio, ciudad o estado"
          />
        </label>
        <button className="btn" type="submit">
          Buscar
        </button>
      </div>

      <div className="buscador-pie">
        <button
          className={conUbicacion ? "btn-ubicacion btn-ubicacion-on" : "btn-ubicacion"}
          type="button"
          onClick={cercaDeMi}
          disabled={ubicando}
        >
          ◉ {ubicando ? "Buscando tu ubicación…" : "Cerca de mí"}
        </button>
        {conUbicacion ? (
          <button className="btn-texto" type="button" onClick={() => irA({ lat: null, lng: null })}>
            Quitar mi ubicación
          </button>
        ) : (
          <span className="buscador-nota">Ordenar por distancia</span>
        )}
      </div>

      {aviso ? (
        <p className="form-msg err" role="status">
          {aviso}
        </p>
      ) : null}
    </form>
  );
}
