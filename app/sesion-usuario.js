import Link from "next/link";
import { cerrarSesion } from "./panel/actions";
import { IconoUsuario } from "./panel/tablero-iconos";

/**
 * Quién entró, en un menú que cuelga del avatar.
 *
 * La misma pieza en el menú público y en la cabecera del panel. Antes el
 * correo iba escrito en la barra y "Salir" al lado; el correo es largo, se
 * comía el ancho del menú y no hacía falta tenerlo delante todo el rato. Ahora
 * la barra solo lleva el avatar y, al pasar el puntero por encima, se abre
 * "Tu cuenta" y "Salir". El correo sigue estando, dentro del menú: es lo que
 * contesta "¿con cuál de mis cuentas estoy?" cuando hace falta preguntarlo.
 *
 * Se abre con `:hover` y también con `:focus-within`, así que el teclado llega
 * a las dos opciones tabulando. En un teléfono no hay puntero: ahí el avatar
 * es un enlace normal y lleva a `href`, que para el dueño son sus restaurantes
 * y para el comensal su cuenta.
 *
 * @param {{correo?: string, foto?: string|null, href?: string, destino?: string}} props
 *   `href` es a dónde lleva el avatar y `destino` a dónde se sale: del panel, a
 *   la puerta; del sitio público, a la portada, que es donde estaba mirando.
 */
export default function SesionUsuario({ correo, foto, href = "/panel", destino }) {
  if (!correo) return null;

  return (
    <div className="menu-usuario">
      <Link className="menu-usuario-boton" href={href} aria-label="Tu cuenta">
        <span className="panel-avatar" aria-hidden="true">
          {foto ? <img src={foto} alt="" width={32} height={32} /> : <IconoUsuario ancho={18} />}
        </span>
      </Link>

      {/* La capa lleva el hueco entre el avatar y la tarjeta como relleno
          propio: si fuera un margen, el menú se cerraría al cruzarlo con el
          puntero. */}
      <div className="menu-usuario-capa">
        <div className="menu-usuario-lista">
          <p className="menu-usuario-correo" title={correo}>
            {correo}
          </p>
          <Link href="/panel/cuenta">Tu cuenta</Link>
          <form action={cerrarSesion}>
            {destino ? <input type="hidden" name="destino" value={destino} /> : null}
            <button type="submit">Salir</button>
          </form>
        </div>
      </div>
    </div>
  );
}
