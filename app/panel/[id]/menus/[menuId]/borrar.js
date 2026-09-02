"use client";

import { borrarMenu } from "../actions";

// Mismo criterio que al borrar un restaurante: la pregunta lleva el nombre
// dentro, porque un "¿seguro?" seco se contesta que sí sin leerlo.
export default function BorrarMenu({ id, menuId, nombre }) {
  return (
    <form
      action={borrarMenu}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Se borra el menú "${nombre}" con sus secciones y platillos. Esto no se puede deshacer.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="menu" value={menuId} />
      <button className="btn-texto btn-peligro" type="submit">
        Borrar menú
      </button>
    </form>
  );
}
