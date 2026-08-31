"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword } from "./actions";

const inicial = { status: "idle", message: "" };

export default function EntrarForm({ next = "/panel" }) {
  const [state, action, pending] = useActionState(signInWithPassword, inicial);

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />

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

      <label className="campo">
        <span>Contraseña</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
        />
      </label>

      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>

      {state.status === "error" ? (
        <p className="form-msg err" role="alert">
          {state.message}
        </p>
      ) : null}

      <p className="ayuda">
        <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
      </p>
    </form>
  );
}
