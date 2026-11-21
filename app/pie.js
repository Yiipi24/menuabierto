import Link from "next/link";
import { CORREO_DE_SOPORTE } from "../lib/soporte";

// El pie del sitio. Lo escribía la portada y ahora lo enseñan también las
// páginas de /comida: el correo de contacto y el año en dos sitios distintos
// son dos sitios donde se puede quedar viejo. La ayuda va aquí porque es donde
// se busca "¿a quién le escribo?" (criterio 6 del tablero, #83).
export default function Pie() {
  return (
    <footer className="footer">
      <div className="wrap wrap-ancho footer-inner">
        <span>© {new Date().getFullYear()} Menú Abierto</span>
        <nav className="footer-enlaces" aria-label="Ayuda y contacto">
          <Link href="/ayuda">Ayuda y preguntas frecuentes</Link>
          <a href={`mailto:${CORREO_DE_SOPORTE}`}>{CORREO_DE_SOPORTE}</a>
        </nav>
      </div>
    </footer>
  );
}
