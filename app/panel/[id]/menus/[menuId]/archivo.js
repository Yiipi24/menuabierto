"use client";

import { useActionState, useRef } from "react";
import { subirArchivoMenu, quitarArchivoMenu } from "../actions";

const inicial = { status: "idle", message: "" };

export default function Archivo({ id, menu, url }) {
  const entrada = useRef(null);
  const [state, action, pending] = useActionState(async (prev, formData) => {
    const resultado = await subirArchivoMenu(prev, formData);
    // Vaciar el input tras subir evita mandar dos veces el mismo archivo.
    if (resultado.status === "ok" && entrada.current) entrada.current.value = "";
    return resultado;
  }, inicial);

  const esPdf = menu.file_mime === "application/pdf";

  return (
    <section className="bloque-menu">
      <h2 className="sub">Tu menú</h2>
      <p className="ayuda">
        Súbelo como lo tienes: PDF o foto, hasta 10 MB. En la ficha aparece un
        botón para abrirlo.
      </p>

      {url ? (
        <div className="menu-archivo">
          {esPdf ? (
            <object className="menu-archivo-vista" data={url} type="application/pdf">
              <p className="ayuda">
                Tu navegador no muestra el PDF aquí.{" "}
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Ábrelo en otra pestaña
                </a>
                .
              </p>
            </object>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="menu-archivo-vista" src={url} alt={`Menú de ${menu.name}`} />
          )}

          <div className="menu-archivo-acciones">
            <a
              className="btn-texto"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir
            </a>
            <form
              action={quitarArchivoMenu}
              onSubmit={(e) => {
                const ok = window.confirm(
                  "Se quita el archivo y el menú deja de verse en la ficha.",
                );
                if (!ok) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="menu" value={menu.id} />
              <button className="btn-texto btn-peligro" type="submit">
                Quitar
              </button>
            </form>
          </div>
        </div>
      ) : (
        <p className="nota-borrador">
          Todavía no has subido el archivo. Hasta que lo hagas, este menú no
          aparece en la ficha.
        </p>
      )}

      <form action={action} className="form-fotos">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menu" value={menu.id} />
        <label className="campo">
          <span>{url ? "Reemplazar el archivo" : "Subir el archivo"}</span>
          <input
            ref={entrada}
            type="file"
            name="archivo"
            accept="application/pdf,image/jpeg,image/png,image/webp"
          />
        </label>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Subiendo…" : url ? "Reemplazar" : "Subir menú"}
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
