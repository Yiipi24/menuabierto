import Link from "next/link";
import { currentUser } from "../lib/supabase";
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
            <Link href="/">Buscar</Link>
          )}
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
