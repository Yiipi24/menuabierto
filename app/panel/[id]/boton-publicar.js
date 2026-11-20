"use client";

import { useState } from "react";
import Modal from "../modal";
import { cambiarEstado } from "../actions";

// Publicar u ocultar. Si a la ficha le falta lo que la hace verse rota —la
// carta o la dirección—, publicar pregunta antes y dice qué falta (#88). No
// lo impide: el dueño puede tener razones para salir hoy así, pero tiene que
// decidirlo sabiendo.
export default function BotonPublicar({ id, publicado, faltan }) {
  const [abierto, setAbierto] = useState(false);
  const avisar = !publicado && faltan.length > 0;

  const formulario = (etiqueta, clase) => (
    <form action={cambiarEstado}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={publicado ? "oculto" : "publicado"} />
      <button className={clase} type="submit">
        {etiqueta}
      </button>
    </form>
  );

  if (!avisar) return formulario(publicado ? "Ocultar" : "Publicar", publicado ? "btn-texto" : "btn");

  return (
    <>
      <button className="btn" type="button" onClick={() => setAbierto(true)}>
        Publicar
      </button>
      <Modal
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Tu ficha va a salir a medias"
        descripcion="Puedes publicarla así, pero quien la abra va a notar que falta:"
      >
        <ul className="modal-lista">
          {faltan.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="modal-acciones">
          <button className="btn" type="button" onClick={() => setAbierto(false)}>
            Completar primero
          </button>
          {formulario("Publicar de todos modos", "btn-texto")}
        </div>
      </Modal>
    </>
  );
}
