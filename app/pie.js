import Link from "next/link";
import { RESPONSABLE } from "../lib/legal";

// El pie del sitio. Vive en el layout raíz para que salga en todas las
// páginas: el aviso de privacidad y los términos tienen que estar a un clic de
// cualquier lugar donde se recabe un dato, y un pie por página es un pie que
// alguna página olvida. La ayuda va aquí porque es donde se busca "¿a quién le
// escribo?" (criterio 6 del tablero, #83).
export default function Pie() {
  return (
    <footer className="footer">
      <div className="wrap wrap-ancho footer-inner">
        <span>© {new Date().getFullYear()} Menú Abierto</span>
        <nav className="footer-enlaces" aria-label="Ayuda y legal">
          <Link href="/ayuda">Ayuda y preguntas frecuentes</Link>
          <Link href="/privacidad">Aviso de privacidad</Link>
          <Link href="/terminos">Términos</Link>
          <a href={`mailto:${RESPONSABLE.correo}`}>{RESPONSABLE.correo}</a>
        </nav>
      </div>
    </footer>
  );
}
