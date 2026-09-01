"use client";

import { useActionState, useState } from "react";
import { registrar } from "./actions";

const inicial = { status: "idle", message: "" };

// Redactadas como intención y no como identidad. "Dueño" deja fuera al gerente
// o a quien lleva las redes, que muchas veces es quien de verdad hace el alta.
const OPCIONES = [
  {
    valor: "comensal",
    titulo: "Busco dónde comer",
    detalle: "Guarda tus favoritos y escribe reseñas.",
  },
  {
    valor: "restaurante",
    titulo: "Tengo un restaurante",
    detalle: "Publica tu menú, tus fotos y tus precios.",
  },
];

export default function RegistroForm({ next = "/" }) {
  const [state, action, pending] = useActionState(registrar, inicial);
  const [intent, setIntent] = useState("comensal");

  if (state.status === "sent") {
    return (
      <div className="aviso">
        <h2>Confirma tu correo</h2>
        <p>
          Te mandamos un mensaje para confirmar que la dirección es tuya. Ábrelo
          y entras directo.
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

      <fieldset className="grupo">
        <legend>¿Qué te trae por aquí?</legend>
        <div className="elecciones">
          {OPCIONES.map((o) => (
            <label
              key={o.valor}
              className={intent === o.valor ? "eleccion eleccion-on" : "eleccion"}
            >
              <input
                type="radio"
                name="intent"
                value={o.valor}
                checked={intent === o.valor}
                onChange={() => setIntent(o.valor)}
              />
              <strong>{o.titulo}</strong>
              <span>{o.detalle}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="campo">
        <span>Tu nombre</span>
        <input type="text" name="full_name" required maxLength={80} autoComplete="name" />
      </label>

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
          minLength={10}
          autoComplete="new-password"
        />
        <small className="pista">Al menos 10 caracteres.</small>
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
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      {state.status === "error" ? (
        <p className="form-msg err" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
