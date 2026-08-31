"use client";

import { useActionState } from "react";
import { guardarContrasena } from "./actions";

const inicial = { status: "idle", message: "" };

export default function CuentaForm({ tieneContrasena }) {
  const [state, action, pending] = useActionState(guardarContrasena, inicial);

  return (
    <form action={action} className="form-alta">
      <label className="campo">
        <span>{tieneContrasena ? "Nueva contraseña" : "Contraseña"}</span>
        <input
          type="password"
          name="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </label>

      <label className="campo">
        <span>Repítela</span>
        <input
          type="password"
          name="password2"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </label>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>

      {state.status !== "idle" ? (
        <p
          className={state.status === "ok" ? "form-msg ok" : "form-msg err"}
          role={state.status === "ok" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
