"use client";

import { useActionState, useMemo, useState } from "react";
import { aplicarExtraccion } from "./actions";
import { aTextoDePrecio } from "../../../../../../lib/precios";

const inicial = { status: "idle", message: "" };

// La pantalla de revisión es obligatoria y editable: el modelo leyó, el dueño
// decide. Cada sección y cada platillo se pueden corregir o desmarcar, y lo
// que se manda al servidor es este estado, no lo que devolvió el modelo.
function estadoInicial(extraccion) {
  return (extraccion?.secciones ?? []).map((s, i) => ({
    clave: `s${i}`,
    nombre: s.nombre,
    platillos: s.platillos.map((p, j) => ({
      clave: `s${i}p${j}`,
      incluir: true,
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      precio: p.precio != null ? aTextoDePrecio(p.precio) : "",
      dudoso: Boolean(p.dudoso),
      precioTexto: p.precioTexto ?? null,
    })),
  }));
}

export default function Revision({ id, menuId, extraccionId, extraccion, resumen, volver }) {
  const [secciones, setSecciones] = useState(() => estadoInicial(extraccion));
  const [state, action, pending] = useActionState(async (prev, formData) => {
    try {
      return await aplicarExtraccion(prev, formData);
    } catch (error) {
      if (String(error?.digest ?? "").startsWith("NEXT_REDIRECT")) throw error;
      console.error("aplicar extracción", error);
      return { status: "error", message: "No pudimos guardar. Inténtalo otra vez." };
    }
  }, inicial);

  const marcados = useMemo(
    () => secciones.reduce((n, s) => n + s.platillos.filter((p) => p.incluir).length, 0),
    [secciones],
  );
  const sinPrecio = useMemo(
    () => secciones.reduce((n, s) => n + s.platillos.filter((p) => p.incluir && !p.precio.trim()).length, 0),
    [secciones],
  );

  const revision = useMemo(
    () =>
      JSON.stringify({
        secciones: secciones.map((s) => ({
          nombre: s.nombre,
          platillos: s.platillos.map((p) => ({
            incluir: p.incluir,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: p.precio,
          })),
        })),
      }),
    [secciones],
  );

  const cambiarSeccion = (clave, cambios) =>
    setSecciones((lista) => lista.map((s) => (s.clave === clave ? { ...s, ...cambios } : s)));
  const cambiarPlatillo = (claveSeccion, clave, cambios) =>
    setSecciones((lista) =>
      lista.map((s) =>
        s.clave !== claveSeccion
          ? s
          : { ...s, platillos: s.platillos.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)) },
      ),
    );
  const marcarSeccion = (claveSeccion, incluir) =>
    setSecciones((lista) =>
      lista.map((s) => (s.clave !== claveSeccion ? s : { ...s, platillos: s.platillos.map((p) => ({ ...p, incluir })) })),
    );
  const agregarPlatillo = (claveSeccion) =>
    setSecciones((lista) =>
      lista.map((s) =>
        s.clave !== claveSeccion
          ? s
          : {
              ...s,
              platillos: [
                ...s.platillos,
                { clave: `${s.clave}n${Date.now()}`, incluir: true, nombre: "", descripcion: "", precio: "", dudoso: false, precioTexto: null },
              ],
            },
      ),
    );

  return (
    <form action={action} className="revision">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="menu" value={menuId} />
      <input type="hidden" name="extraccion" value={extraccionId} />
      <input type="hidden" name="revision" value={revision} />

      <p className="revision-resumen" role="status">
        Leímos <b>{resumen.platillos}</b> {resumen.platillos === 1 ? "platillo" : "platillos"} en{" "}
        <b>{resumen.secciones}</b> {resumen.secciones === 1 ? "sección" : "secciones"}
        {resumen.sinPrecio ? `; ${resumen.sinPrecio} sin precio legible` : ""}.
      </p>

      {secciones.map((s) => {
        const todos = s.platillos.every((p) => p.incluir);
        return (
          <fieldset className="revision-seccion" key={s.clave}>
            <legend className="revision-seccion-cabeza">
              <input
                type="text"
                className="revision-seccion-nombre"
                value={s.nombre}
                maxLength={60}
                aria-label="Nombre de la sección"
                onChange={(e) => cambiarSeccion(s.clave, { nombre: e.target.value })}
              />
              <button type="button" className="btn-texto" onClick={() => marcarSeccion(s.clave, !todos)}>
                {todos ? "Desmarcar todos" : "Marcar todos"}
              </button>
            </legend>

            <ul className="revision-lista">
              {s.platillos.map((p) => (
                <li key={p.clave} className={p.incluir ? "revision-platillo" : "revision-platillo es-fuera"}>
                  <label className="revision-marca">
                    <input
                      type="checkbox"
                      checked={p.incluir}
                      onChange={(e) => cambiarPlatillo(s.clave, p.clave, { incluir: e.target.checked })}
                      aria-label={`Incluir ${p.nombre || "este platillo"}`}
                    />
                  </label>
                  <input
                    type="text"
                    className="revision-nombre"
                    value={p.nombre}
                    maxLength={120}
                    placeholder="Nombre del platillo"
                    aria-label="Nombre del platillo"
                    onChange={(e) => cambiarPlatillo(s.clave, p.clave, { nombre: e.target.value })}
                  />
                  <input
                    type="text"
                    className={p.dudoso && !p.precio ? "revision-precio es-dudoso" : "revision-precio"}
                    inputMode="decimal"
                    value={p.precio}
                    placeholder={p.dudoso && p.precioTexto ? `¿${p.precioTexto}?` : "Precio"}
                    aria-label="Precio"
                    title={p.dudoso && p.precioTexto ? `En la carta se leyó "${p.precioTexto}"` : undefined}
                    onChange={(e) => cambiarPlatillo(s.clave, p.clave, { precio: e.target.value })}
                  />
                  <input
                    type="text"
                    className="revision-descripcion"
                    value={p.descripcion}
                    maxLength={300}
                    placeholder="Descripción (opcional)"
                    aria-label="Descripción"
                    onChange={(e) => cambiarPlatillo(s.clave, p.clave, { descripcion: e.target.value })}
                  />
                </li>
              ))}
            </ul>
            <button type="button" className="btn-texto" onClick={() => agregarPlatillo(s.clave)}>
              + Agregar un platillo a esta sección
            </button>
          </fieldset>
        );
      })}

      <div className="revision-pie">
        <p className="ayuda">
          Se guardarán <b>{marcados}</b> {marcados === 1 ? "platillo" : "platillos"}
          {sinPrecio ? ` (${sinPrecio} sin precio, se publican sin él)` : ""}. Después puedes editarlos uno por uno, ponerles icono y etiquetas.
        </p>
        <div className="revision-acciones">
          <button className="btn" type="submit" disabled={pending || marcados === 0}>
            {pending ? "Guardando…" : `Guardar ${marcados} en el menú`}
          </button>
          <a className="btn-texto" href={volver}>
            Descartar
          </a>
        </div>
        {state.status === "error" ? (
          <p className="form-msg err" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
