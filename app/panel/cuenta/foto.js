"use client";

import { useActionState, useRef, useState } from "react";
import { subirFotoDeCuenta, quitarFotoDeCuenta } from "./actions";
import { MAX_AVATAR_BYTES, TIPOS_FOTO, revisarArchivos } from "../../../lib/subidas";
import { IconoUsuario } from "../tablero-iconos";

const inicial = { status: "idle", message: "" };

/**
 * La foto de la cuenta: la que sale en el menú de arriba.
 *
 * Enseña lo que se va a guardar antes de guardarlo —el navegador ya tiene el
 * archivo, así que la vista previa no cuesta un viaje al servidor— y el peso
 * se revisa aquí antes de mandarlo: una imagen de más de dos megas rebotaría
 * igual, pero después de gastar la subida entera.
 */
export default function FotoDeCuenta({ foto }) {
  const entrada = useRef(null);
  const [previa, setPrevia] = useState(null);

  const [state, action, pending] = useActionState(async (prev, formData) => {
    const archivos = formData.getAll("foto").filter((f) => f && f.size > 0);
    const aviso = revisarArchivos(archivos, {
      tipos: TIPOS_FOTO,
      maxBytes: MAX_AVATAR_BYTES,
      queEs: "la foto",
    });
    if (aviso) return { status: "error", message: aviso };

    try {
      const resultado = await subirFotoDeCuenta(prev, formData);
      if (resultado.status === "ok") {
        // Se limpia lo local: a partir de aquí manda la foto guardada, que es
        // la que ya viene pintada desde el servidor.
        if (entrada.current) entrada.current.value = "";
        setPrevia(null);
      }
      return resultado;
    } catch (error) {
      console.error("subir foto de cuenta", error);
      return {
        status: "error",
        message: "No pudimos subir la foto. Revisa tu conexión e inténtalo otra vez.",
      };
    }
  }, inicial);

  const [quitando, setQuitando] = useState(false);
  const [avisoQuitar, setAvisoQuitar] = useState(null);

  async function quitar() {
    setQuitando(true);
    setAvisoQuitar(null);
    try {
      const resultado = await quitarFotoDeCuenta();
      setAvisoQuitar(resultado);
      setPrevia(null);
    } catch (error) {
      console.error("quitar foto de cuenta", error);
      setAvisoQuitar({ status: "error", message: "No pudimos quitar la foto." });
    } finally {
      setQuitando(false);
    }
  }

  const mostrada = previa ?? foto;
  const mensaje = avisoQuitar ?? (state.status !== "idle" ? state : null);

  return (
    <section className="foto-cuenta">
      <div className="foto-cuenta-muestra">
        {mostrada ? (
          <img src={mostrada} alt="Tu foto de la cuenta" width={72} height={72} />
        ) : (
          <span className="foto-cuenta-vacia" aria-hidden="true">
            <IconoUsuario ancho={30} />
          </span>
        )}
      </div>

      <div className="foto-cuenta-lado">
        <p className="ayuda">
          Sale en el menú de arriba, junto a tu nombre de cuenta. JPG, PNG,
          WebP o AVIF, hasta 2 MB. Se recorta en un círculo, así que funciona
          mejor una imagen cuadrada.
        </p>

        <form action={action} className="foto-cuenta-form">
          <label className="campo">
            <span className="sr-only">Elegir una foto</span>
            <input
              ref={entrada}
              type="file"
              name="foto"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => {
                const archivo = e.currentTarget.files?.[0];
                setPrevia(archivo ? URL.createObjectURL(archivo) : null);
                setAvisoQuitar(null);
              }}
            />
          </label>
          <div className="foto-cuenta-botones">
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Subiendo…" : foto ? "Cambiar foto" : "Subir foto"}
            </button>
            {foto ? (
              <button
                className="btn-linea btn-peligro"
                type="button"
                onClick={quitar}
                disabled={quitando}
              >
                {quitando ? "Quitando…" : "Quitar"}
              </button>
            ) : null}
          </div>
        </form>

        {mensaje ? (
          <p
            className={mensaje.status === "ok" ? "form-msg ok" : "form-msg err"}
            role={mensaje.status === "ok" ? "status" : "alert"}
          >
            {mensaje.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
