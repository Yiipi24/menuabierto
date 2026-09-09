"use client";

import { useActionState, useState } from "react";
import { extraerMenu } from "./actions";
import { MAX_ARCHIVO_BYTES, revisarArchivos } from "../../../../../../lib/subidas";
import { TIPOS_IMAGEN, TIPO_PDF } from "../../../../../../lib/extraccion";

const inicial = { status: "idle", message: "" };
const TIPOS = [...TIPOS_IMAGEN, TIPO_PDF];

export default function Subir({ id, menu, cupo, habilitado, volver }) {
  const [usarArchivo, setUsarArchivo] = useState(false);
  const [state, action, pending] = useActionState(async (prev, formData) => {
    if (formData.get("usar_archivo") !== "on") {
      const archivos = formData.getAll("archivo").filter((f) => f && f.size > 0);
      if (!archivos.length) return { status: "error", message: "Elige la foto o el PDF de tu carta." };
      const aviso = revisarArchivos(archivos, {
        tipos: TIPOS,
        maxBytes: MAX_ARCHIVO_BYTES,
        queEs: "la foto",
      });
      if (aviso) return { status: "error", message: aviso };
    }
    try {
      return await extraerMenu(prev, formData);
    } catch (error) {
      // redirect() viaja como excepción y Next la maneja; lo demás es nuestro.
      if (String(error?.digest ?? "").startsWith("NEXT_REDIRECT")) throw error;
      console.error("extraer menú", error);
      return { status: "error", message: "No pudimos leer la carta. Revisa tu conexión e inténtalo otra vez." };
    }
  }, inicial);

  const quedan = state.quedan ?? cupo.quedan;
  const sinCupo = quedan <= 0;
  const tieneArchivo = Boolean(menu.file_path);

  return (
    <section className="bloque-menu">
      <form action={action} className="form-fotos">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menu" value={menu.id} />

        {tieneArchivo ? (
          <label className="campo campo-casilla">
            <input
              type="checkbox"
              name="usar_archivo"
              checked={usarArchivo}
              onChange={(e) => setUsarArchivo(e.target.checked)}
            />
            <span>
              Leer el archivo que este menú ya tiene subido
              {menu.file_mime === "application/pdf" ? " (PDF)" : " (imagen)"}
            </span>
          </label>
        ) : null}

        {usarArchivo ? null : (
          <label className="campo">
            <span>La foto o el PDF de tu carta</span>
            <input
              type="file"
              name="archivo"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              capture="environment"
              disabled={pending || !habilitado || sinCupo}
            />
            <em>Una página por foto, de frente, con buena luz y sin reflejos. Hasta 10 MB.</em>
          </label>
        )}

        <button className="btn" type="submit" disabled={pending || !habilitado || sinCupo}>
          {pending ? "Leyendo la carta…" : "Leer la carta"}
        </button>

        {pending ? (
          <p className="ayuda" role="status">
            Puede tardar hasta un minuto. No cierres esta página.
          </p>
        ) : null}

        {state.status !== "idle" ? (
          <p className="form-msg err" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>

      <p className="nota-borrador">
        {habilitado
          ? sinCupo
            ? `Tu plan incluye ${cupo.incluidas} lecturas al mes y ya las usaste. Vuelven el mes que entra, o suben con el plan.`
            : `Te quedan ${quedan} de ${cupo.incluidas} lecturas este mes. Una foto ilegible también cuenta, así que tómala bien.`
          : "La lectura de cartas todavía no está habilitada en este sitio."}
        {" "}
        <a href={volver}>Capturar a mano</a>
      </p>
    </section>
  );
}
