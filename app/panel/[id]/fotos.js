"use client";

import { useActionState, useRef } from "react";
import { subirFotos, borrarFoto } from "./actions";

const inicial = { status: "idle", message: "" };

export default function Fotos({ id, fotos }) {
  const entrada = useRef(null);
  const [state, action, pending] = useActionState(
    async (prev, formData) => {
      const resultado = await subirFotos(prev, formData);
      // Vaciar el input tras subir evita mandar dos veces las mismas fotos.
      if (resultado.status === "ok" && entrada.current) entrada.current.value = "";
      return resultado;
    },
    inicial,
  );

  return (
    <section className="bloque-fotos">
      <h2 className="sub">Fotos del restaurante</h2>
      <p className="ayuda">
        La primera es la que se ve en el directorio. JPG, PNG o WebP, hasta 5 MB
        cada una.
      </p>

      {fotos.length ? (
        <ul className="galeria">
          {fotos.map((f) => (
            <li key={f.id} className="galeria-foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.alt ?? ""} loading="lazy" />
              <form action={borrarFoto}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="foto" value={f.id} />
                <button className="galeria-borrar" type="submit" aria-label="Borrar foto">
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nota-borrador">Todavía no hay fotos.</p>
      )}

      <form action={action} className="form-fotos">
        <input type="hidden" name="id" value={id} />
        <label className="campo">
          <span>Agregar fotos</span>
          <input
            ref={entrada}
            type="file"
            name="fotos"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
          />
        </label>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Subiendo…" : "Subir fotos"}
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
