import Link from "next/link";
import { notFound } from "next/navigation";
import Brand from "../../../brand";
import Carta from "../carta";
import { cargar, PRECIO } from "../datos";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const datos = await cargar(slug);
    if (!datos) return { title: "Restaurante no encontrado — Menú Abierto" };
    const { r } = datos;
    return {
      title: `Menú de ${r.name} | Menú Abierto`,
      description: `Platillos y precios de ${r.name}.`,
    };
  } catch {
    return { title: "Menú Abierto" };
  }
}

export default async function MenuCompleto({ params }) {
  const { slug } = await params;

  let datos = null;
  try {
    datos = await cargar(slug);
  } catch {
    datos = null;
  }
  if (!datos) notFound();

  const { r, cocinas, menus } = datos;
  const ficha = `/r/${encodeURIComponent(slug)}`;

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Brand />
          <div className="nav-links">
            <Link href="/">Buscar</Link>
            <Link className="btn btn-sm" href="/registro">
              Publica tu menú
            </Link>
          </div>
        </div>
      </nav>

      <main className="wrap ficha ficha-menu-pagina">
        <Link className="btn-texto ficha-volver" href={ficha}>
          ← Volver a {r.name}
        </Link>

        <header className="menu-pagina-encabezado">
          <h1>{menus.length === 1 ? menus[0].name : "Menú"}</h1>
          <p className="ficha-tipo">
            {r.name}
            {cocinas.length ? ` · ${cocinas.join(" · ")}` : ""}
            {r.price_level ? ` · ${PRECIO[r.price_level]}` : ""}
          </p>
        </header>

        <Carta menus={menus} restaurante={r} />
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span>© {new Date().getFullYear()} Menú Abierto</span>
          <a href="mailto:hola@menuabierto.com">hola@menuabierto.com</a>
        </div>
      </footer>
    </>
  );
}
