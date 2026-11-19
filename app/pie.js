import Link from "next/link";
import { RESPONSABLE } from "../lib/legal";

// El pie del sitio. Vive en el layout raíz para que salga en todas las
// páginas: el aviso de privacidad y los términos tienen que estar a un clic de
// cualquier lugar donde se recabe un dato, y un pie por página es un pie que
// alguna página olvida.
export default function Pie() {
  return (
    <footer className="footer">
      <div className="wrap wrap-ancho footer-inner">
        <span>© {new Date().getFullYear()} Menú Abierto</span>
        <nav className="footer-legal" aria-label="Legal">
          <Link href="/privacidad">Aviso de privacidad</Link>
          <Link href="/terminos">Términos</Link>
          <a href={`mailto:${RESPONSABLE.correo}`}>{RESPONSABLE.correo}</a>
        </nav>
      </div>
    </footer>
  );
}
