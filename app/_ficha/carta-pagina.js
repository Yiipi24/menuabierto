import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "../nav";
import Carta from "./carta";
import { MedirVista } from "../medir";
import { cargar, PRECIO } from "./datos";
import { rutaFicha, rutaMenu } from "../../lib/slug";

// Una carta suelta se busca dentro de las visibles: si el dueño la ocultó o la
// borró, el QR que ya está pegado en la barra da 404 en vez de enseñar algo
// que el restaurante ya no sirve.
function cartaDe(menus, menuId) {
  if (!menuId) return menus;
  const uno = menus.find((m) => m.id === menuId);
  return uno ? [uno] : null;
}

export const dynamic = "force-dynamic";

export async function metadataCarta(slug, menuId = null) {
  try {
    const datos = await cargar(slug);
    if (!datos) return { title: "Restaurante no encontrado — Menú Abierto" };
    const { r, menus } = datos;
    const solo = menuId ? menus.find((m) => m.id === menuId) : null;
    if (menuId && !solo) return { title: "Menú no encontrado — Menú Abierto" };
    const nombre = solo ? `${solo.name} de ${r.name}` : `Menú de ${r.name}`;
    return {
      title: `${nombre} | Menú Abierto`,
      description: solo
        ? `${solo.name} de ${r.name}: platillos y precios.`
        : `Platillos y precios de ${r.name}.`,
    };
  } catch {
    return { title: "Menú Abierto" };
  }
}

export default async function CartaPagina({ slug, menuId = null }) {
  let datos = null;
  try {
    datos = await cargar(slug);
  } catch {
    datos = null;
  }
  if (!datos) notFound();

  const { r, cocinas, menus, destacados } = datos;

  // Con un id en la ruta la página es la de una sola carta: es la que abre el
  // QR pegado en la barra o en la mesa, y no debe traerse las demás detrás.
  const cartas = cartaDe(menus, menuId);
  if (!cartas) notFound();

  const ficha = rutaFicha(slug);
  const solo = menuId ? cartas[0] : null;
  // Desde una carta suelta hay dos salidas: el resto de las cartas, si las
  // hay, y la ficha. Desde la carta completa solo la ficha.
  const hayOtras = Boolean(solo) && menus.length > 1;

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
      <Nav />

      <main className="wrap ficha ficha-menu-pagina">
        {/* El menú también es una visita a la ficha: quien llega por el QR
            nunca pasa por la portada, y sin esto su visita no existiría. */}
        <MedirVista
          slug={slug}
          eventos={["restaurant_view", "menu_view"]}
          menuId={solo?.id ?? null}
        />
        {/* Las dos salidas van en la misma fila: apiladas dejaban un hueco de
            dos renglones antes de la carta, que es lo único que se vino a
            ver. */}
        <div className="carta-salidas">
          <Link className="btn-texto ficha-volver" href={ficha}>
            ← Volver a {r.name}
          </Link>

          {hayOtras ? (
            <Link className="btn-texto ficha-volver" href={rutaMenu(slug)}>
              Ver las {menus.length} cartas de {r.name}
            </Link>
          ) : null}
        </div>

        {/* Cada carta trae su propio encabezado —así se ve completa cuando
            alguien la abre por el QR—, así que el título de la página solo
            existe para el lector de pantalla y el buscador. */}
        <h1 className="sr-only">
          {solo ? `${solo.name} de ${r.name}` : `Menú de ${r.name}`}
        </h1>

        <Carta
          menus={cartas}
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
