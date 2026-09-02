"use client";

import { useActionState, useState } from "react";
import { PLANTILLAS } from "../../../../../lib/plantillas";
import { guardarMenu } from "../actions";

const inicial = { status: "idle", message: "" };

export default function Ajustes({ id, menu }) {
  const [state, action, pending] = useActionState(guardarMenu, inicial);
  // El tipo se lleva en estado porque decide si tiene sentido enseñar la
  // plantilla: un menú subido se ve como el archivo que es.
  const [tipo, setTipo] = useState(menu.kind);

  return (
    <section className="bloque-menu">
      <h2 className="sub">Ajustes del menú</h2>

      <form action={action} className="form-alta">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menu" value={menu.id} />

        <label className="campo">
          <span>Nombre</span>
          <input
            type="text"
            name="nombre"
            defaultValue={menu.name}
            required
            maxLength={60}
          />
        </label>

        <label className="campo">
          <span>Cómo está puesto</span>
          <select name="kind" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="digital">Capturado aquí, platillo por platillo</option>
            <option value="archivo">Un archivo que subo yo</option>
          </select>
        </label>

        {tipo === "digital" ? (
          <label className="campo">
            <span>
              Plantilla <em>cambia cómo se ve, no lo que dice</em>
            </span>
            <select name="template" defaultValue={menu.template}>
              {PLANTILLAS.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.nombre} — {p.descripcion}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="template" value={menu.template} />
        )}

        <label className="eleccion eleccion-sola">
          <input type="checkbox" name="visible" defaultChecked={menu.is_visible} />
          <span>
            <strong>Se ve en la ficha</strong>
            <em>Quítale la palomita para prepararlo sin que nadie lo vea.</em>
          </span>
        </label>

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar ajustes"}
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
    </section>
  );
}
