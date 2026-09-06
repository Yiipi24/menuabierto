import Link from "next/link";
import { currentUser } from "../lib/supabase";
import { avisosSinLeer } from "./_social/datos";
import { IconoCampana } from "./_social/iconos";
import Brand from "./brand";

// El menú de arriba es el mismo en todas las páginas públicas, pero cambia en
// dos ejes: el primer enlace lleva a lo que no estás viendo (la portada ya es
// la búsqueda, así que ahí ofrece la parte de restaurantes), y el segundo
// depende de si hay sesión: quien ya entró no necesita "Iniciar sesión", sino
// la puerta a su panel.
export default async function Nav({ landing = false }) {
  let usuario = null;
  try {
    usuario = await currentUser();
  } catch {
    // Sin configuración de Supabase la página pública sigue sirviendo: se
    // dibuja el menú de quien no ha entrado.
  }

  // El punto de los avisos sin leer. Solo con sesión, y un fallo aquí no puede
  // dejar sin menú a toda la página: sale sin punto y ya.
  let sinLeer = 0;
  if (usuario) {
    try {
      sinLeer = await avisosSinLeer(usuario.id);
    } catch {
      sinLeer = 0;
    }
  }

  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <Brand />
        <div className="nav-links">
          {landing ? (
            <Link className="hide-sm" href="#restaurantes">
              Para restaurantes
            </Link>
          ) : (
            // En un teléfono con sesión, este sitio de la fila se lo queda
            // "Novedades": el logo ya lleva a la búsqueda y los dos juntos
            // partían el botón de crear cuenta en tres renglones.
            <Link className={usuario ? "hide-sm" : undefined} href="/">
              Buscar
            </Link>
          )}
          {/* Las novedades solo se ofrecen a quien puede tenerlas: un feed de
              "los que sigues" sin cuenta no significa nada. */}
          {usuario ? (
            <Link className="nav-avisos" href="/novedades">
              {/* En un teléfono el menú ya va justo de ancho, así que el
                  enlace se queda con su campana y suelta la palabra. El punto
                  es lo que había que conservar: dice que hay algo esperando. */}
              <IconoCampana ancho={18} />
              <span className="nav-avisos-texto">Novedades</span>
              {sinLeer ? (
                <span className="nav-punto" aria-label={`${sinLeer} sin leer`}>
                  {sinLeer > 9 ? "9+" : sinLeer}
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link className="hide-sm" href={usuario ? "/panel" : "/entrar"}>
            {usuario ? "Mi cuenta" : "Iniciar sesión"}
          </Link>
          <Link className="btn btn-sm" href="/registro">
            Crea tu cuenta
          </Link>
        </div>
      </div>
    </nav>
  );
}
