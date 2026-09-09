"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { reportarResena } from "./actions";
import { MOTIVOS, MAX_DETALLE } from "../../lib/resenas";

const inicial = { status: "idle", message: "" };

// Reportar una reseña. Es un enlace discreto —"Reportar"— y no un botón: se
// usa poco y no debe competir con la reseña. Sin sesión lleva a entrar y
// vuelve aquí; el autor no la ve porque su reseña la borra él.
export default function Reportar({ slug, reviewId, usuarioId, volverA }) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState(reportarResena, inicial);

  if (state.status === "ok") {
    return (
      <p className="resena-reportar-listo" role="status">
        {state.message}
      </p>
    );
  }

  if (!usuarioId) {
    return (
      <Link className="resena-reportar" href={`/entrar?next=${encodeURIComponent(volverA)}`}>
        Reportar
      </Link>
    );
  }

  if (!abierto) {
    return (
      <button type="button" className="resena-reportar" onClick={() => setAbierto(true)}>
        Reportar
      </button>
    );
  }

  return (
    <form action={action} className="resena-reportar-form">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="review_id" value={reviewId} />
      <fieldset>
        <legend>¿Qué tiene esta reseña?</legend>
        {MOTIVOS.map((m) => (
          <label key={m.slug} className="eleccion">
            <input type="radio" name="motivo" value={m.slug} required />
            <span>
              <strong>{m.nombre}</strong>
              <br />
              <small>{m.pista}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="campo">
        <span>Detalle (opcional)</span>
        <textarea name="detalle" rows={2} maxLength={MAX_DETALLE} />
      </label>
      <div className="resena-respuesta-acciones">
        <button className="btn btn-sm" type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar reporte"}
        </button>
        <button type="button" className="btn-texto" onClick={() => setAbierto(false)} disabled={pending}>
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
