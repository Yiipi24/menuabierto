"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PLANTILLAS, PLANTILLA_POR_DEFECTO } from "../../../../lib/plantillas";
import { FRANJAS, FRANJA_POR_DEFECTO, franjaDe } from "../../../../lib/horarios-menu";
import { crearMenu } from "./actions";

const inicial = { status: "idle", message: "" };

// La miniatura de cada plantilla. Son cuatro rectángulos y una línea: dibujar
// la carta de verdad en 130 px no se entendería, y una captura sería una
// imagen que hay que rehacer cada vez que se toque el CSS de las plantillas.
//
// `columnas` y `conFoto` salen de la propia plantilla, así que la miniatura no
// puede mentir sobre lo que se va a ver.
function Miniatura({ plantilla }) {
  const dos = plantilla.base.columnas === "dos";
  const conFoto = plantilla.base.iconos;
  const renglones = dos ? [0, 1, 2, 3] : [0, 1, 2];

  return (
    <span className={`mini mini-${dos ? "dos" : "una"}`} aria-hidden="true">
      {renglones.map((i) => (
        <span className="mini-fila" key={i}>
          {conFoto ? <span className="mini-foto" /> : null}
          <span className="mini-texto">
            <span className="mini-linea" />
            <span className="mini-linea corta" />
          </span>
          <span className="mini-precio" />
        </span>
      ))}
    </span>
  );
}

/**
 * "Crear un nuevo menú".
 *
 * Vive debajo de los menús que ya existen y no en otra pantalla: dar de alta
 * la segunda carta es lo que más se hace aquí, y mandarlo a un formulario
 * aparte convierte un gesto en dos pantallas.
 */
export default function NuevoMenu({ id, quedan, cupo }) {
  const router = useRouter();
  const formulario = useRef(null);
  const [tipo, setTipo] = useState("digital");
  const [plantilla, setPlantilla] = useState(PLANTILLA_POR_DEFECTO);
  const [franja, setFranja] = useState(FRANJA_POR_DEFECTO);

  const [state, action, pending] = useActionState(async (prev, formData) => {
    const resultado = await crearMenu(prev, formData);
    if (resultado.status === "ok") {
      limpiar();
      // Recién creado, lo siguiente que quiere hacer el dueño es llenarlo.
      if (resultado.menuId) router.push(`/panel/${id}/menus/${resultado.menuId}`);
    }
    return resultado;
  }, inicial);

  function limpiar() {
    formulario.current?.reset();
    setTipo("digital");
    setPlantilla(PLANTILLA_POR_DEFECTO);
    setFranja(FRANJA_POR_DEFECTO);
  }

  if (quedan === 0) return null;

  return (
    <section className="bloque-nuevo" id="crear-menu">
      <div className="bloque-nuevo-titulo">
        <h2 className="sub">Crear un nuevo menú</h2>
        <span className="pastilla">
          Te {quedan === 1 ? "queda" : "quedan"} {quedan} de tus {cupo}.
        </span>
      </div>

      <form action={action} className="form-alta" ref={formulario}>
        <input type="hidden" name="id" value={id} />

        <label className="campo">
          <span>Nombre del menú</span>
          <input
            type="text"
            name="nombre"
            required
            maxLength={60}
            placeholder="Ej. Carta principal, Menú del día, Bebidas, Postres…"
          />
        </label>

        <fieldset className="grupo">
          <legend>¿Cómo lo vas a poner?</legend>
          <div className="opciones-par">
            {[
              {
                valor: "digital",
                titulo: "Capturarlo aquí",
                texto:
                  "Agregas secciones y platillos con precio. Se ve bien en el teléfono y sale en las búsquedas.",
              },
              {
                valor: "archivo",
                titulo: "Subir el mío",
                texto:
                  "Tu menú en PDF o imagen, tal como lo tienes. Lo más rápido, pero los platillos no se pueden buscar.",
              },
            ].map((o) => (
              <label
                className={`opcion-caja${tipo === o.valor ? " opcion-on" : ""}`}
                key={o.valor}
              >
                <input
                  type="radio"
                  name="kind"
                  value={o.valor}
                  checked={tipo === o.valor}
                  onChange={() => setTipo(o.valor)}
                />
                <span className="opcion-cuerpo">
                  <strong>{o.titulo}</strong>
                  <em>{o.texto}</em>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>
            ¿A qué hora se sirve? <em>puedes cambiarlo cuando quieras</em>
          </legend>
          <label className="campo campo-suelto">
            <span className="sr-only">Franja</span>
            <select name="franja" value={franja} onChange={(e) => setFranja(e.target.value)}>
              {FRANJAS.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
          <p className="campo-pista">{franjaDe(franja).pista}</p>
        </fieldset>

        {/* La plantilla solo decide cómo se pinta lo capturado; un menú subido
            se ve como el archivo que es. */}
        {tipo === "digital" ? (
          <fieldset className="grupo">
            <legend>
              Plantilla <em>puedes cambiarla cuando quieras</em>
            </legend>
            <div className="plantillas">
              {PLANTILLAS.map((p) => (
                <label
                  className={`plantilla-card${plantilla === p.slug ? " plantilla-on" : ""}`}
                  key={p.slug}
                >
                  <input
                    type="radio"
                    name="template"
                    value={p.slug}
                    checked={plantilla === p.slug}
                    onChange={() => setPlantilla(p.slug)}
                  />
                  <Miniatura plantilla={p} />
                  <span className="plantilla-nombre">{p.nombre}</span>
                  <span className="plantilla-texto">{p.descripcion}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="form-acciones">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear menú"}
          </button>
          <button type="button" className="btn-linea btn-sm" onClick={limpiar}>
            Cancelar
          </button>
        </div>

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
