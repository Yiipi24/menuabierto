import Link from "next/link";
import { notFound } from "next/navigation";
import Brand from "../brand";
import Carta from "./carta";
import { MedirVista } from "../medir";
import { cargar, PRECIO } from "./datos";
import { rutaFicha } from "../../lib/slug";

export const dynamic = "force-dynamic";

export async function metadataCarta(slug) {
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

export default async function CartaPagina({ slug }) {
  let datos = null;
  try {
    datos = await cargar(slug);
  } catch {
    datos = null;
  }
  if (!datos) notFound();

  const { r, cocinas, menus, destacados } = datos;
  const ficha = rutaFicha(slug);

  // La línea de abajo del título es la misma en todas las plantillas: el
  // restaurante, su cocina y su nivel de precio. Se arma aquí una vez.
  const linea = [
    r.name,
    cocinas.length ? cocinas.join(" · ") : null,
    r.price_level ? PRECIO[r.price_level] : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
        {/* El menú también es una visita a la ficha: quien llega por el QR
            nunca pasa por la portada, y sin esto su visita no existiría. */}
        <MedirVista slug={slug} eventos={["restaurant_view", "menu_view"]} />
        <Link className="btn-texto ficha-volver" href={ficha}>
          ← Volver a {r.name}
        </Link>

        {/* Cada carta trae su propio encabezado —así se ve completa cuando
            alguien la abre por el QR—, así que el título de la página solo
            existe para el lector de pantalla y el buscador. */}
        <h1 className="sr-only">Menú de {r.name}</h1>

        <Carta
          menus={menus}
          restaurante={{ name: r.name, linea }}
          destacados={destacados}
        />
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
