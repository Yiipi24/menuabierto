"use client";

import { useState } from "react";
import { useActionState } from "react";
import Modal from "../../modal";
import {
  TIPOS,
  TIPO_POR_DEFECTO,
  aTextoDeValor,
  llevaCifra,
  normalizarCodigo,
  tipoDe,
} from "../../../../lib/cupones";
import { crearCupon, guardarCupon } from "./actions";

const inicial = { status: "idle", message: "" };

// La fecha del `<input type="date">` es "2026-09-30"; lo guardado es un
// instante. Se recorta para volver a llenar el campo.
function dia(valor) {
  return valor ? String(valor).slice(0, 10) : "";
}

/**
 * El formulario del cupón, que sirve para crearlo y para editarlo.
 *
 * Es el mismo porque los campos son los mismos: tener dos acabaría con uno
 * validando lo que el otro acepta. Lo único que cambia es la acción a la que
 * se manda y el texto del botón.
 */
export default function FormularioCupon({ id, cupon = null, abierto, alCerrar }) {
  const editar = Boolean(cupon);
  const [tipo, setTipo] = useState(cupon?.kind ?? TIPO_POR_DEFECTO);
  const [codigo, setCodigo] = useState(cupon?.code ?? "");

  const [estado, accion, pendiente] = useActionState(async (prev, formData) => {
    const r = editar ? await guardarCupon(prev, formData) : await crearCupon(prev, formData);
    if (r.status === "ok") alCerrar();
    return r;
  }, inicial);

  const elegido = tipoDe(tipo);

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={editar ? `Editar ${cupon.code}` : "Crear un cupón"}
      descripcion="El código es lo que tu cliente dice en la caja. Es lo que te deja saber cuántos de los que vieron la promoción de verdad vinieron."
    >
      <form action={accion}>
        <input type="hidden" name="id" value={id} />
        {editar ? <input type="hidden" name="cupon" value={cupon.id} /> : null}

        <label className="campo">
          <span>Título</span>
          <input
            type="text"
            name="titulo"
            required
            maxLength={80}
            defaultValue={cupon?.title ?? ""}
            placeholder="Ej. 15% en toda la cuenta"
            autoFocus
          />
        </label>

        <label className="campo">
          <span>
            Código <em>lo dice el cliente en la caja</em>
          </span>
          {/* Se normaliza mientras se escribe: así lo que el dueño ve en el
              campo es exactamente lo que se va a guardar y lo que va a salir
              impreso en la ficha. */}
          <input
            type="text"
            name="codigo"
            required
            maxLength={16}
            className="campo-codigo"
            value={codigo}
            onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
            placeholder="VERANO25"
          />
        </label>

        <div className="campo-par">
          <label className="campo">
            <span>Tipo de descuento</span>
            <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>

          {llevaCifra(tipo) ? (
            <label className="campo">
              <span>{elegido.campo}</span>
              <input
                type="text"
                name="valor"
                required
                inputMode="numeric"
                defaultValue={aTextoDeValor(cupon?.kind, cupon?.value_int)}
                placeholder={tipo === "porcentaje" ? "15" : "50"}
              />
            </label>
          ) : (
            <p className="campo-pista campo-pista-alto">{elegido.pista}</p>
          )}
        </div>

        <label className="campo">
          <span>
            Descripción <em>opcional</em>
          </span>
          <textarea
            name="descripcion"
            maxLength={300}
            rows={2}
            defaultValue={cupon?.description ?? ""}
            placeholder="Cuéntale al cliente en qué consiste."
          />
        </label>

        <label className="campo">
          <span>
            Condiciones <em>opcional</em>
          </span>
          <input
            type="text"
            name="condiciones"
            maxLength={300}
            defaultValue={cupon?.terms ?? ""}
            placeholder="No acumulable. No aplica en bebidas alcohólicas."
          />
        </label>

        <div className="campo-par">
          <label className="campo">
            <span>
              Desde <em>opcional</em>
            </span>
            <input type="date" name="desde" defaultValue={dia(cupon?.starts_at)} />
          </label>
          <label className="campo">
            <span>
              Hasta <em>opcional</em>
            </span>
            <input type="date" name="hasta" defaultValue={dia(cupon?.ends_at)} />
          </label>
        </div>

        <label className="campo">
          <span>
            Máximo de canjes <em>opcional</em>
          </span>
          <input
            type="text"
            name="maximo"
            inputMode="numeric"
            defaultValue={cupon?.max_redemptions ?? ""}
            placeholder="Déjalo vacío si no quieres tope"
          />
        </label>
        <p className="campo-pista">
          Con un tope, el cupón se apaga solo al llegar a esa cantidad. Sirve para
          las primeras 50 mesas y no para todo el mes.
        </p>

        {estado.status !== "idle" && estado.message ? (
          <p
            className={estado.status === "ok" ? "form-msg ok" : "form-msg err"}
            role={estado.status === "ok" ? "status" : "alert"}
          >
            {estado.message}
          </p>
        ) : null}

        <div className="modal-botones">
          <button type="button" className="btn-linea btn-sm" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={pendiente}>
            {pendiente ? "Guardando…" : editar ? "Guardar cambios" : "Crear cupón"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
