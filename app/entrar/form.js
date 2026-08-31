"use client";

import { useActionState, useState } from "react";
import { requestMagicLink, signInWithPassword } from "./actions";

const inicial = { status: "idle", message: "" };

function Enlace({ next }) {
  const [state, action, pending] = useActionState(requestMagicLink, inicial);

  if (state.status === "sent") {
    return (
      <div className="aviso">
        <h2>Revisa tu correo</h2>
        <p>
          Te mandamos un enlace para entrar. Ábrelo en este mismo dispositivo:
          solo funciona en el navegador desde el que lo pediste.
        </p>
        <p className="aviso-nota">
          Si no llega en un par de minutos, revisa la carpeta de spam.
        </p>
      </div>
    );
  }

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

      {/* Trampa para bots: invisible y fuera del recorrido de teclado. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="trap"
      />

      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviarme el enlace"}
      </button>

      {state.status === "error" ? (
        <p className="form-msg err" role="alert">
          {state.message}
        </p>
      ) : null}

      <p className="ayuda">
        Te mandamos un enlace de un solo uso. Sirve aunque no recuerdes tu
        contraseña.
      </p>
    </form>
  );
}

function Contrasena({ next }) {
  const [state, action, pending] = useActionState(signInWithPassword, inicial);

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />

      <label className="campo">
        <span>Tu correo</span>
        <input type="email" name="email" required autoComplete="email" />
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
        ¿Olvidaste tu contraseña? Entra con un enlace y cámbiala desde tu
        cuenta.
      </p>
    </form>
  );
}

export default function EntrarForm({ next = "/panel" }) {
  const [modo, setModo] = useState("contrasena");

  return (
    <>
      <div className="roles" role="tablist" aria-label="Cómo quieres entrar">
        {[
          ["contrasena", "Con contraseña"],
          ["enlace", "Con un enlace"],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={modo === valor}
            className={modo === valor ? "role role-on" : "role"}
            onClick={() => setModo(valor)}
          >
            {texto}
          </button>
        ))}
      </div>

      {modo === "enlace" ? <Enlace next={next} /> : <Contrasena next={next} />}
    </>
  );
}
