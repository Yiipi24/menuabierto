"use client";

import { useActionState, useState } from "react";
import Modal from "../../modal";
import FormularioCupon from "./formulario";
import {
  conversion,
  estadoDeCupon,
  textoDelDescuento,
  textoDeVigencia,
} from "../../../../lib/cupones";
import { IconoCupon, IconoLapiz, IconoBote, IconoMas } from "../../tablero-iconos";
import { alternarCupon, borrarCupon, canjearCupon } from "./actions";

const inicial = { status: "idle", message: "" };

/**
 * "Registrar un canje": la caja.
 *
 * Es lo primero de la pantalla y no un detalle al final, porque es lo único
 * que se usa a diario y con prisa. Se escribe el código que trae el cliente y
 * ya; la acción contesta si sirve, si venció o si se acabó, que es exactamente
 * lo que hay que decirle al cliente que está enfrente.
 */
export function CajaDeCanjes({ id, hayCupones }) {
  const [estado, accion, pendiente] = useActionState(canjearCupon, inicial);

  if (!hayCupones) return null;

  return (
    <section className="caja-canje">
      <div className="caja-canje-texto">
        <h2>¿Alguien trae un código?</h2>
        <p>Escríbelo para registrar el canje. Así sabes cuántos de verdad vinieron.</p>
      </div>

      <form action={accion} className="caja-canje-form">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor="codigo-canje">
          Código del cupón
        </label>
        <input
          id="codigo-canje"
          type="text"
          name="codigo"
          required
          maxLength={16}
          className="campo-codigo"
          placeholder="VERANO25"
          autoComplete="off"
        />
        <button className="btn" type="submit" disabled={pendiente}>
          {pendiente ? "Registrando…" : "Registrar canje"}
        </button>
      </form>

      {estado.status !== "idle" && estado.message ? (
        <p
          className={estado.status === "ok" ? "form-msg ok" : "form-msg err"}
          role={estado.status === "ok" ? "status" : "alert"}
        >
          {estado.message}
        </p>
      ) : null}
    </section>
  );
}

// El botón de arriba y el formulario viven en el mismo componente porque
// comparten el diálogo: la pantalla lo pone donde quiera.
export function BotonNuevoCupon({ id, texto = "Crear un cupón", clase = "btn btn-con-icono" }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button type="button" className={clase} onClick={() => setAbierto(true)}>
        <IconoMas ancho={18} />
        {texto}
      </button>
      <FormularioCupon id={id} abierto={abierto} alCerrar={() => setAbierto(false)} />
    </>
  );
}

/**
 * Una fila de cupón, con sus tres cifras.
 *
 * Vistas, copias y canjes van juntos y en ese orden porque así se lee el
 * embudo de izquierda a derecha: cuánta gente lo vio, cuánta se llevó el
 * código y cuánta lo usó. La conversión de la punta es la única cifra que
 * dice si la promoción sirvió.
 *
 * @param {{metricas: {vistas: number, copias: number, canjes: number}}} props
 */
export function FilaCupon({ id, cupon, metricas, periodo }) {
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const estado = estadoDeCupon(cupon);
  const tasa = conversion(metricas.vistas, metricas.canjes);

  return (
    <li className="fila-cupon">
      <div className="fila-cupon-datos">
        <div className="fila-cupon-titulo">
          <span className="codigo-pastilla">
            <IconoCupon ancho={15} />
            {cupon.code}
          </span>
          <span className={`estado estado-${estado.slug}`}>{estado.nombre}</span>
        </div>

        <p className="fila-cupon-nombre">{cupon.title}</p>
        <p className="fila-meta">
          {textoDelDescuento(cupon)} · {textoDeVigencia(cupon)}
          {cupon.max_redemptions
            ? ` · ${cupon.redemptions_count} de ${cupon.max_redemptions} canjes`
            : ` · ${cupon.redemptions_count} ${
                cupon.redemptions_count === 1 ? "canje" : "canjes"
              } en total`}
        </p>
      </div>

      <dl className="cupon-cifras" aria-label={`Resultados de ${cupon.code} en ${periodo}`}>
        <div>
          <dt>Vistas</dt>
          <dd>{metricas.vistas}</dd>
        </div>
        <div>
          <dt>Códigos copiados</dt>
          <dd>{metricas.copias}</dd>
        </div>
        <div>
          <dt>Canjes</dt>
          <dd>{metricas.canjes}</dd>
        </div>
        <div className="cupon-cifra-fuerte">
          <dt>Conversión</dt>
          <dd>{tasa == null ? "—" : `${tasa}%`}</dd>
        </div>
      </dl>

      <div className="fila-botones">
        <form action={alternarCupon}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="cupon" value={cupon.id} />
          <button className="btn-fila" type="submit">
            {cupon.is_active ? "Apagar" : "Encender"}
          </button>
        </form>

        <button type="button" className="btn-fila" onClick={() => setEditando(true)}>
          <IconoLapiz ancho={16} />
          Editar
        </button>

        <button type="button" className="btn-icono" onClick={() => setBorrando(true)} aria-label={`Eliminar el cupón ${cupon.code}`}>
          <IconoBote ancho={17} />
        </button>
      </div>

      <FormularioCupon
        id={id}
        cupon={cupon}
        abierto={editando}
        alCerrar={() => setEditando(false)}
      />

      <Modal
        abierto={borrando}
        alCerrar={() => setBorrando(false)}
        titulo={`¿Eliminar el cupón ${cupon.code}?`}
        descripcion="Se borra el cupón y el historial de canjes que llevaba. Esta acción no se puede deshacer. Si solo quieres dejar de ofrecerlo, apágalo: así conservas lo que midió."
      >
        <form action={borrarCupon}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="cupon" value={cupon.id} />
          <div className="modal-botones">
            <button type="button" className="btn-linea btn-sm" onClick={() => setBorrando(false)}>
              Cancelar
            </button>
            <button className="btn btn-peligro-solido" type="submit">
              Sí, eliminar cupón
            </button>
          </div>
        </form>
      </Modal>
    </li>
  );
}
