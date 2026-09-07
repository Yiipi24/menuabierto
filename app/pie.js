// El pie del sitio. Lo escribía la portada y ahora lo enseñan también las
// páginas de /comida: el correo de contacto y el año en dos sitios distintos
// son dos sitios donde se puede quedar viejo.
export default function Pie() {
  return (
    <footer className="footer">
      <div className="wrap wrap-ancho footer-inner">
        <span>© {new Date().getFullYear()} Menú Abierto</span>
        <a href="mailto:hola@menuabierto.com">hola@menuabierto.com</a>
      </div>
    </footer>
  );
}
