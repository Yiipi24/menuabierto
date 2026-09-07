import Link from "next/link";
import { currentUser } from "../../lib/supabase";
import { fotoDeCuenta } from "../../lib/avatar";
import Brand from "../brand";
import SesionUsuario from "../sesion-usuario";

/**
 * La barra de arriba del panel.
 *
 * Estaba escrita a mano en cada pantalla y solo el tablero enseñaba quién
 * había entrado; en el resto se perdía de vista con qué cuenta se estaba
 * trabajando, que es justo lo que importa cuando alguien administra los
 * restaurantes de dos negocios. Ahora es una sola pieza: mientras haya sesión,
 * el correo y "Salir" acompañan al dueño por todo el panel.
 *
 * @param {{atras?: string, atrasTexto?: string, marca?: string, correo?: string}} props
 */
export default async function CabeceraPanel({
  atras,
  atrasTexto = "Volver",
  marca,
  correo,
  usuarioId,
}) {
  const usuario = correo && usuarioId ? null : await currentUser();
  const email = correo ?? usuario?.email;
  const foto = await fotoDeCuenta(usuarioId ?? usuario?.id);

  return (
    <header className="panel-top">
      <Brand href={marca ?? atras ?? "/"} />
      <div className="panel-top-derecha">
        {atras ? (
          <Link className="btn-texto" href={atras}>
            {atrasTexto}
          </Link>
        ) : null}
        <SesionUsuario correo={email} foto={foto} href="/panel/cuenta" />
      </div>
    </header>
  );
}
