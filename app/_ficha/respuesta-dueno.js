"use client";

import { useActionState, useState } from "react";
import { responderResena } from "./actions";
import { MAX_RESPUESTA } from "../../lib/resenas";

const inicial = { status: "idle", message: "" };

// La respuesta del dueño bajo una reseña: una sola, editable, y que se puede
// retirar dejándola vacía. Se abre al tocar "Responder" para que la lista de
// reseñas no sea una fila de cajas de texto.
export default function RespuestaDueno({ slug, reviewId, respuesta }) {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState(respuesta ?? "");
  const [state, action, pending] = useActionState(async (prev, formData) => {
    const r = await responderResena(prev, formData);
    if (r.status === "ok") setAbierta(false);
    return r;
  }, inicial);

  if (!abierta) {
    return (
      <div className="resena-responder">
        <button type="button" className="btn-texto" onClick={() => setAbierta(true)}>
          {respuesta ? "Editar tu respuesta" : "Responder"}
        </button>
        {state.status === "ok" ? (
          <span className="form-msg ok" role="status">
            {state.message}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="resena-respuesta-form">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="review_id" value={reviewId} />
      <label className="campo">
        <span>Tu respuesta pública</span>
        <textarea
          name="respuesta"
          rows={3}
          maxLength={MAX_RESPUESTA}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Gracias por venir. Tomamos nota de lo del servicio…"
        />
        <em>La ve cualquiera que abra tu ficha. Si la dejas vacía, se retira.</em>
      </label>
      <div className="resena-respuesta-acciones">
        <button className="btn btn-sm" type="submit" disabled={pending}>
          {pending ? "Guardando…" : respuesta ? "Guardar cambios" : "Publicar respuesta"}
        </button>
        <button type="button" className="btn-texto" onClick={() => setAbierta(false)} disabled={pending}>
          Cancelar
        </button>
      </div>
      {state.status === "error" ? (
        <p className="form-msg err" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
