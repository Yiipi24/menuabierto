"use client";

import { borrarRestaurante } from "./actions";

// Borrar es irreversible y se lleva las fotos y el menú por delante, así que
// pide confirmación con el nombre escrito en la pregunta: un "¿seguro?" seco
// se contesta que sí sin leerlo.
export default function BorrarRestaurante({ id, nombre }) {
  return (
    <form
      action={borrarRestaurante}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Se borra "${nombre}" con su menú y sus fotos. Esto no se puede deshacer.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn-texto btn-peligro" type="submit">
        Borrar
      </button>
    </form>
  );
}
