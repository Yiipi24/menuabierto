"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { alternarFavorito } from "./favoritos";

// El corazón de cada tarjeta. Cambia en cuanto se pulsa y solo después habla
// con el servidor: guardar un restaurante no es una operación de la que haya
// que esperar confirmación, y si algo falla se regresa a como estaba.
//
// A quien no ha entrado no se le esconde el botón. Se le enseña, y al pulsarlo
// se le explica para qué sirve: es más fácil decidir crear una cuenta con el
// restaurante que te gustó enfrente que con un formulario en blanco.
export default function Favorito({ restauranteId, nombre, guardado = false }) {
  const [activo, setActivo] = useState(guardado);
  const [aviso, setAviso] = useState(false);
  const [pendiente, empezar] = useTransition();

  function pulsar() {
    const siguiente = !activo;
    setActivo(siguiente);
    setAviso(false);

    empezar(async () => {
      const resultado = await alternarFavorito(restauranteId, siguiente);
      if (!resultado.ok) {
        setActivo(!siguiente);
        if (resultado.motivo === "sesion") setAviso(true);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={activo ? "favorito favorito-on" : "favorito"}
        onClick={pulsar}
        disabled={pendiente}
        aria-pressed={activo}
        title={activo ? `Quitar ${nombre} de guardados` : `Guardar ${nombre}`}
      >
        <span className="hueso-oculto">
          {activo ? `Quitar ${nombre} de guardados` : `Guardar ${nombre}`}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 20.4 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13z" />
        </svg>
      </button>

      {aviso ? (
        <p className="favorito-aviso" role="status">
          Entra a tu cuenta para guardar restaurantes.{" "}
          <Link href="/entrar">Iniciar sesión</Link>
        </p>
      ) : null}
    </>
  );
}
