"use client";

import { useActionState } from "react";
import { desvincularRed, vincularRed } from "./actions";
import { REDES_CUENTA } from "../../../lib/redes-cuenta";
import { IconoRed } from "../../redes-iconos";

const inicial = { status: "idle", message: "" };

// Las redes de la cuenta del comensal.
//
// Vincular una red aquí sirve para entrar con ella, y para nada más: no
// publicamos en su nombre ni leemos su muro, y la tarjeta lo dice para que
// nadie lo suponga al revés.
export default function RedesDeCuenta({ identidades }) {
  const porProveedor = new Map((identidades ?? []).map((i) => [i.proveedor, i]));
  const soloUna = (identidades ?? []).length <= 1;

  return (
    <ul className="cuenta-redes">
      {REDES_CUENTA.map((red) => (
        <Fila
          key={red.slug}
          red={red}
          identidad={porProveedor.get(red.proveedor) ?? null}
          soloUna={soloUna}
        />
      ))}
    </ul>
  );
}

function Fila({ red, identidad, soloUna }) {
  const [estadoVincular, accionVincular, vinculando] = useActionState(vincularRed, inicial);
  const [estadoQuitar, accionQuitar, quitando] = useActionState(desvincularRed, inicial);

  const estado = estadoVincular.message ? estadoVincular : estadoQuitar;

  return (
    <li className={identidad ? "cuenta-red conectada" : "cuenta-red"}>
      <span className={`post-red-logo es-${red.slug}`} aria-hidden="true">
        <IconoRed slug={red.slug} ancho={22} />
      </span>

      <span className="cuenta-red-texto">
        <strong>{red.nombre}</strong>
        <span className={identidad ? "post-red-estado es-viva" : "post-red-estado"}>
          {identidad ? `Vinculada${identidad.cuenta ? ` · ${identidad.cuenta}` : ""}` : red.pista}
        </span>
      </span>

      {identidad ? (
        <form action={accionQuitar}>
          <input type="hidden" name="identidad" value={identidad.id} />
          <button className="btn-linea btn-sm" type="submit" disabled={quitando || soloUna}>
            {quitando ? "Desvinculando…" : "Desvincular"}
          </button>
        </form>
      ) : (
        <form action={accionVincular}>
          <input type="hidden" name="proveedor" value={red.proveedor} />
          <button className="btn-linea btn-sm" type="submit" disabled={vinculando}>
            {vinculando ? "Abriendo…" : "Conectar"}
          </button>
        </form>
      )}

      {identidad && soloUna ? (
        <p className="cuenta-red-aviso">
          Es tu única forma de entrar. Ponle una contraseña a tu cuenta para poder
          desvincularla.
        </p>
      ) : null}

      {estado.message ? (
        <p
          className={
            estado.status === "ok" ? "cuenta-red-aviso es-ok" : "cuenta-red-aviso es-error"
          }
          role="status"
        >
          {estado.message}
        </p>
      ) : null}
    </li>
  );
}
