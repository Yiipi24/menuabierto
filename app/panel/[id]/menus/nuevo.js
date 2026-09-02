"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PLANTILLAS, PLANTILLA_POR_DEFECTO } from "../../../../lib/plantillas";
import { crearMenu } from "./actions";

const inicial = { status: "idle", message: "" };

export default function NuevoMenu({ id, quedan, cupo }) {
  const router = useRouter();
  const formulario = useRef(null);
  const [tipo, setTipo] = useState("digital");
  const [state, action, pending] = useActionState(async (prev, formData) => {
    const resultado = await crearMenu(prev, formData);
    if (resultado.status === "ok") {
      formulario.current?.reset();
      setTipo("digital");
      // Recién creado, lo siguiente que quiere hacer el dueño es llenarlo.
      if (resultado.menuId) router.push(`/panel/${id}/menus/${resultado.menuId}`);
    }
    return resultado;
  }, inicial);

  if (quedan === 0) return null;

  return (
    <section className="bloque-menu-nuevo">
      <h2 className="sub">Agregar un menú</h2>
      <p className="ayuda">
        Te {quedan === 1 ? "queda" : "quedan"} {quedan} de tus {cupo}.
      </p>

      <form action={action} className="form-alta" ref={formulario}>
        <input type="hidden" name="id" value={id} />

        <label className="campo">
          <span>Nombre del menú</span>
          <input
            type="text"
            name="nombre"
            required
            maxLength={60}
            placeholder="Carta principal, Bebidas, Menú del día…"
          />
        </label>

        <fieldset className="grupo">
          <legend>¿Cómo lo vas a poner?</legend>
          <label className="eleccion">
            <input
              type="radio"
              name="kind"
              value="digital"
              checked={tipo === "digital"}
              onChange={() => setTipo("digital")}
            />
            <span>
              <strong>Capturarlo aquí</strong>
              <em>
                Agregas secciones y dentro sus platillos con precio. Se ve bien
                en el teléfono y sale en las búsquedas.
              </em>
            </span>
          </label>
          <label className="eleccion">
            <input
              type="radio"
              name="kind"
              value="archivo"
              checked={tipo === "archivo"}
              onChange={() => setTipo("archivo")}
            />
            <span>
              <strong>Subir el mío</strong>
              <em>
                Tu menú en PDF o foto, tal como lo tienes. Lo más rápido, pero
                los platillos no se pueden buscar.
              </em>
            </span>
          </label>
        </fieldset>

        {/* La plantilla solo decide cómo se pinta lo capturado; un menú subido
            se ve como el archivo que es. */}
        {tipo === "digital" ? (
          <label className="campo">
            <span>
              Plantilla <em>puedes cambiarla cuando quieras</em>
            </span>
            <select name="template" defaultValue={PLANTILLA_POR_DEFECTO}>
              {PLANTILLAS.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.nombre} — {p.descripcion}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear menú"}
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
