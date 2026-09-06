"use client";

import { useActionState } from "react";
import { pedirRecuperacion } from "./actions";
import { PROPS_TRAMPA } from "../../lib/trampa";

const inicial = { status: "idle", message: "" };

export default function RecuperarForm() {
  const [state, action, pending] = useActionState(pedirRecuperacion, inicial);

  if (state.status === "sent") {
    return (
      <div className="aviso">
        <h2>Revisa tu correo</h2>
        <p>
          Si esa dirección tiene una cuenta, te mandamos un enlace para elegir
          una contraseña nueva. Ábrelo en este mismo navegador.
        </p>
        <p className="aviso-nota">
          Si no llega en un par de minutos, revisa la carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <form action={action}>
      <label className="campo">
        <span>Tu correo</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
        />
      </label>

      {/* Trampa para bots: invisible y fuera del recorrido de teclado. */}
      <input {...PROPS_TRAMPA} />

      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviarme el enlace"}
      </button>

      {state.status === "error" ? (
        <p className="form-msg err" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
