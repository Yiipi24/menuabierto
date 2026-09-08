"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Modal from "../../modal";
import { FRANJAS, franjaDe, horaCorta } from "../../../../lib/horarios-menu";
import {
  IconoBote,
  IconoCopiar,
  IconoEstrella,
  IconoLapiz,
  IconoOjo,
  IconoOjoTachado,
  IconoPuntos,
  IconoReloj,
  IconoTexto,
} from "../../tablero-iconos";
import {
  borrarMenu,
  cambiarHorarioMenu,
  cambiarVisibilidadMenu,
  duplicarMenu,
  establecerPrincipalMenu,
  renombrarMenu,
} from "./actions";

const inicial = { status: "idle", message: "" };

// Las cuatro cosas que abren un diálogo. Solo una a la vez: el desplegable se
// cierra al elegir y lo que queda abierto es el diálogo.
const NINGUNO = null;

function Mensaje({ estado }) {
  if (estado.status === "idle" || !estado.message) return null;
  return (
    <p
      className={estado.status === "ok" ? "form-msg ok" : "form-msg err"}
      role={estado.status === "ok" ? "status" : "alert"}
    >
      {estado.message}
    </p>
  );
}

/**
 * El menú de tres puntos de cada carta, con sus diálogos.
 *
 * Todo lo que cambia datos vive en un `<form action={...}>` con una acción de
 * servidor: sin JavaScript el desplegable no se abre, pero nada de lo que hay
 * dentro depende de que el navegador ejecute nuestro código para funcionar una
 * vez enviado.
 *
 * @param {{sucursales: Array<{id: string, name: string, city: string}>}} props
 */
export default function AccionesDeMenu({ id, menu, sucursales = [] }) {
  const [abierto, setAbierto] = useState(false);
  const [dialogo, setDialogo] = useState(NINGUNO);
  const caja = useRef(null);

  // Un desplegable que no se cierra al tocar fuera se queda tapando la fila de
  // abajo, que es justo la que se quería tocar.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (!caja.current?.contains(e.target)) setAbierto(false);
    };
    const escape = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  function abrir(cual) {
    setAbierto(false);
    setDialogo(cual);
  }

  const cerrar = () => setDialogo(NINGUNO);

  return (
    <div className="menu-acciones" ref={caja}>
      <button
        type="button"
        className="btn-icono"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Más opciones de ${menu.name}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <IconoPuntos ancho={18} />
      </button>

      {abierto ? (
        <div className="menu-flotante" role="menu">
          <Link
            className="menu-opcion"
            role="menuitem"
            href={`/panel/${id}/menus/${menu.id}`}
            onClick={() => setAbierto(false)}
          >
            <IconoLapiz ancho={17} />
            Editar contenido
          </Link>

          <button type="button" className="menu-opcion" role="menuitem" onClick={() => abrir("nombre")}>
            <IconoTexto ancho={17} />
            Cambiar nombre
          </button>

          <button type="button" className="menu-opcion" role="menuitem" onClick={() => abrir("horario")}>
            <IconoReloj ancho={17} />
            Cambiar horario
          </button>

          <button type="button" className="menu-opcion" role="menuitem" onClick={() => abrir("duplicar")}>
            <IconoCopiar ancho={17} />
            Duplicar
          </button>

          <div className="menu-raya" />

          {/* Visibilidad y principal son de un solo toque: no hay nada que
              preguntar y un diálogo para confirmarlas sobraría. */}
          <form action={cambiarVisibilidadMenu} onSubmit={() => setAbierto(false)}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="menu" value={menu.id} />
            <button type="submit" className="menu-opcion" role="menuitem">
              {menu.is_visible ? <IconoOjoTachado ancho={17} /> : <IconoOjo ancho={17} />}
              {menu.is_visible ? "Ocultar de la ficha" : "Mostrar en la ficha"}
            </button>
          </form>

          {menu.is_primary ? null : (
            <form action={establecerPrincipalMenu} onSubmit={() => setAbierto(false)}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="menu" value={menu.id} />
              <button type="submit" className="menu-opcion" role="menuitem">
                <IconoEstrella ancho={17} />
                Establecer como principal
              </button>
            </form>
          )}

          <div className="menu-raya" />

          <button
            type="button"
            className="menu-opcion menu-opcion-peligro"
            role="menuitem"
            onClick={() => abrir("borrar")}
          >
            <IconoBote ancho={17} />
            Eliminar menú
          </button>
        </div>
      ) : null}

      <DialogoNombre abierto={dialogo === "nombre"} alCerrar={cerrar} id={id} menu={menu} />
      <DialogoHorario abierto={dialogo === "horario"} alCerrar={cerrar} id={id} menu={menu} />
      <DialogoDuplicar
        abierto={dialogo === "duplicar"}
        alCerrar={cerrar}
        id={id}
        menu={menu}
        sucursales={sucursales}
      />
      <DialogoBorrar abierto={dialogo === "borrar"} alCerrar={cerrar} id={id} menu={menu} />
    </div>
  );
}

function DialogoNombre({ abierto, alCerrar, id, menu }) {
  const [estado, accion, pendiente] = useActionState(async (prev, formData) => {
    const r = await renombrarMenu(prev, formData);
    if (r.status === "ok") alCerrar();
    return r;
  }, inicial);

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Cambiar nombre"
      descripcion="Es el nombre que ven tus clientes en la ficha y en el QR."
    >
      <form action={accion}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menu" value={menu.id} />
        <label className="campo">
          <span>Nombre del menú</span>
          <input
            type="text"
            name="nombre"
            required
            maxLength={60}
            defaultValue={menu.name}
            autoFocus
          />
        </label>
        <Mensaje estado={estado} />
        <div className="modal-botones">
          <button type="button" className="btn-linea btn-sm" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// El horario tiene dos capas: la franja, que es lo que casi todos van a tocar,
// y las horas exactas, que solo hacen falta cuando el local no encaja con el
// horario de fábrica de esa franja.
function DialogoHorario({ abierto, alCerrar, id, menu }) {
  const [franja, setFranja] = useState(menu.service_time ?? "siempre");
  const [estado, accion, pendiente] = useActionState(async (prev, formData) => {
    const r = await cambiarHorarioMenu(prev, formData);
    if (r.status === "ok") alCerrar();
    return r;
  }, inicial);

  const elegida = franjaDe(franja);

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="¿A qué hora se sirve?"
      descripcion="La ficha pone primero las cartas que se están sirviendo ahora, y marca las que todavía no."
    >
      <form action={accion}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menu" value={menu.id} />

        <label className="campo">
          <span>Franja</span>
          <select name="franja" value={franja} onChange={(e) => setFranja(e.target.value)}>
            {FRANJAS.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
        <p className="campo-pista">{elegida.pista}</p>

        <div className="campo-par">
          <label className="campo">
            <span>
              Desde <em>opcional</em>
            </span>
            <input type="time" name="desde" defaultValue={horaCorta(menu.serves_from)} />
          </label>
          <label className="campo">
            <span>
              Hasta <em>opcional</em>
            </span>
            <input type="time" name="hasta" defaultValue={horaCorta(menu.serves_to)} />
          </label>
        </div>
        <p className="campo-pista">
          {elegida.desde
            ? `Si lo dejas vacío usamos el horario normal de esta franja: de ${elegida.desde} a ${elegida.hasta}.`
            : "Déjalo vacío si se sirve a cualquier hora que estés abierto."}
        </p>

        <Mensaje estado={estado} />
        <div className="modal-botones">
          <button type="button" className="btn-linea btn-sm" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar horario"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Duplicar sirve para dos cosas distintas con el mismo botón: hacerse una
// copia aquí para cambiarla sin tocar la original, y llevarse la carta a otra
// sucursal sin volver a capturarla platillo por platillo. El selector de
// destino solo aparece cuando hay más de una sucursal.
function DialogoDuplicar({ abierto, alCerrar, id, menu, sucursales }) {
  const [estado, accion, pendiente] = useActionState(async (prev, formData) => {
    const r = await duplicarMenu(prev, formData);
    if (r.status === "ok") alCerrar();
    return r;
  }, inicial);

  const otras = sucursales.filter((s) => s.id !== id);

  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={`Duplicar "${menu.name}"`}
      descripcion="Se copian las secciones y los platillos con sus precios. La copia nace oculta para que la revises antes de publicarla."
    >
      <form action={accion}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menu" value={menu.id} />

        {otras.length ? (
          <label className="campo">
            <span>¿Dónde?</span>
            <select name="destino" defaultValue={id}>
              <option value={id}>Aquí mismo</option>
              {otras.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? ` — ${s.city}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="destino" value={id} />
        )}

        <label className="campo">
          <span>
            Nombre de la copia <em>opcional</em>
          </span>
          <input
            type="text"
            name="nombre"
            maxLength={60}
            placeholder={`${menu.name} (copia)`}
          />
        </label>

        <Mensaje estado={estado} />
        <div className="modal-botones">
          <button type="button" className="btn-linea btn-sm" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={pendiente}>
            {pendiente ? "Duplicando…" : "Duplicar menú"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Borrar es lo único que no se puede deshacer, así que la pregunta lleva el
// nombre dentro y dice qué se va con él: un "¿seguro?" seco se contesta que sí
// sin leerlo.
function DialogoBorrar({ abierto, alCerrar, id, menu }) {
  return (
    <Modal
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={`¿Eliminar "${menu.name}"?`}
      descripcion="Se borra el menú con todas sus secciones y platillos. Esta acción no se puede deshacer."
    >
      <form action={borrarMenu}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menu" value={menu.id} />
        <div className="modal-botones">
          <button type="button" className="btn-linea btn-sm" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn btn-peligro-solido" type="submit">
            Sí, eliminar menú
          </button>
        </div>
      </form>
    </Modal>
  );
}
