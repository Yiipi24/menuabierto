"use client";

import { useState } from "react";

export default function Waitlist() {
  const [role, setRole] = useState("comensal");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState({ status: "idle", message: "" });

  async function onSubmit(event) {
    event.preventDefault();
    setState({ status: "sending", message: "" });

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, company }),
      });
      const body = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: body.error ?? "No pudimos guardar tu correo. Inténtalo otra vez.",
        });
        return;
      }

      setEmail("");
      setState({ status: "ok", message: "Listo. Te escribimos en cuanto abramos." });
    } catch {
      setState({
        status: "error",
        message: "No pudimos guardar tu correo. Inténtalo otra vez.",
      });
    }
  }

  return (
    <form className="waitlist" onSubmit={onSubmit}>
      <div className="roles" role="radiogroup" aria-label="¿Qué eres?">
        {[
          ["comensal", "Busco dónde comer"],
          ["restaurante", "Tengo un restaurante"],
        ].map(([value, label]) => (
          <label
            key={value}
            className={role === value ? "role role-on" : "role"}
          >
            <input
              type="radio"
              name="role"
              value={value}
              checked={role === value}
              onChange={() => setRole(value)}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Trampa para bots: invisible y fuera del recorrido de teclado. */}
      <input
        type="text"
        name="company"
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="trap"
      />

      <div className="form">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
          aria-label="Tu correo electrónico"
        />
        <button className="btn" type="submit" disabled={state.status === "sending"}>
          {state.status === "sending" ? "Enviando…" : "Avísame"}
        </button>
      </div>

      <p
        className={
          state.status === "ok"
            ? "form-msg ok"
            : state.status === "error"
              ? "form-msg err"
              : "form-msg"
        }
        role="status"
      >
        {state.message}
      </p>
    </form>
  );
}
