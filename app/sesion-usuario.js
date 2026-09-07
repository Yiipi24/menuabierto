import Link from "next/link";
import { cerrarSesion } from "./panel/actions";
import { IconoUsuario } from "./panel/tablero-iconos";

/**
 * Quién entró, y la puerta de salida.
 *
 * La misma pieza en el menú público y en la cabecera del panel: quien entró
 * ve su correo en los dos sitios y no tiene que adivinar con qué cuenta está
 * mirando. En un teléfono el correo se esconde y queda el avatar, que ya dice
 * que hay sesión.
 *
 * @param {{correo?: string, href?: string, destino?: string}} props
 *   `href` es a dónde lleva el chip y `destino` a dónde se sale: del panel, a
 *   la puerta; del sitio público, a la portada, que es donde estaba mirando.
 */
export default function SesionUsuario({ correo, href = "/panel", destino }) {
  if (!correo) return null;

  return (
    <>
      <Link className="btn-texto panel-usuario" href={href} title={correo}>
        <span className="panel-correo">{correo}</span>
        <span className="panel-avatar" aria-hidden="true">
          <IconoUsuario ancho={18} />
        </span>
      </Link>
      <form action={cerrarSesion}>
        {destino ? <input type="hidden" name="destino" value={destino} /> : null}
        <button className="btn-texto" type="submit">
          Salir
        </button>
      </form>
    </>
  );
}
