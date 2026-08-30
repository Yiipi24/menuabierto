"use client";

import { useActionState } from "react";
import { crearRestaurante } from "../actions";

const inicial = { status: "idle", message: "" };

const PRECIOS = [
  ["1", "$", "Económico"],
  ["2", "$$", "Medio"],
  ["3", "$$$", "Alto"],
  ["4", "$$$$", "Muy alto"],
];

export default function NuevoForm({ cuisines }) {
  const [state, action, pending] = useActionState(crearRestaurante, inicial);

  return (
    <form action={action} className="form-alta">
      <label className="campo">
        <span>Nombre del restaurante</span>
        <input type="text" name="name" required maxLength={120} />
      </label>

      <div className="campo-par">
        <label className="campo">
          <span>Ciudad</span>
          <input type="text" name="city" required maxLength={80} />
        </label>
        <label className="campo">
          <span>Colonia <em>(opcional)</em></span>
          <input type="text" name="neighborhood" maxLength={80} />
        </label>
      </div>

      <label className="campo">
        <span>En una línea <em>(opcional)</em></span>
        <input
          type="text"
          name="summary"
          maxLength={140}
          placeholder="Tacos al pastor y suadero desde 1998"
        />
      </label>

      <fieldset className="grupo">
        <legend>Rango de precio</legend>
        <div className="opciones">
          {PRECIOS.map(([valor, simbolo, texto], i) => (
            <label className="opcion" key={valor}>
              <input
                type="radio"
                name="price_level"
                value={valor}
                defaultChecked={i === 1}
              />
              <span className="opcion-cara">
                <strong>{simbolo}</strong>
                {texto}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>
          Tipo de comida <em>(puedes elegir varios)</em>
        </legend>
        <div className="chips">
          {cuisines.map((c) => (
            <label className="chip" key={c.slug}>
              <input type="checkbox" name="cuisines" value={c.slug} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="nota-borrador">
        Se guarda como <strong>borrador</strong>. Nadie lo ve hasta que tú lo
        publiques, así que puedes cargarlo con calma.
      </p>

      <button className="btn btn-block" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar restaurante"}
      </button>

      {state.status === "error" ? (
        <p className="form-msg err" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
