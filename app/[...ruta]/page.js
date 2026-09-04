import { notFound } from "next/navigation";
import { slugValido } from "../../lib/slug";
import Ficha, { metadataFicha } from "../_ficha/ficha";
import CartaPagina, { metadataCarta } from "../_ficha/carta-pagina";

export const dynamic = "force-dynamic";

// Las fichas cuelgan de la raíz: menuabierto.com/jcsmokehouse. No hay un
// prefijo que las separe del resto del sitio, así que esta ruta atrapa todo lo
// que no coincidió antes con /panel, /entrar o /api — en Next las rutas fijas
// ganan siempre a la comodín, y `lib/slug` guarda esa misma lista para que un
// restaurante no pueda quedarse con una de ellas.
//
// Un slug puede traer colonia (`tacoselgordo/centro`), así que la carta es
// siempre el último tramo y no el segundo.
function leerRuta(partes) {
  const tramos = (partes ?? []).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });

  const esMenu = tramos.length > 1 && tramos[tramos.length - 1] === "menu";
  const slug = (esMenu ? tramos.slice(0, -1) : tramos).join("/");
  return { slug, esMenu };
}

export async function generateMetadata({ params }) {
  const { ruta } = await params;
  const { slug, esMenu } = leerRuta(ruta);
  if (!slugValido(slug)) return { title: "Menú Abierto" };
  return esMenu ? metadataCarta(slug) : metadataFicha(slug);
}

export default async function Publica({ params }) {
  const { ruta } = await params;
  const { slug, esMenu } = leerRuta(ruta);

  // Una dirección con tres tramos, con mayúsculas o con guiones no es de una
  // ficha: se corta aquí en vez de gastar un viaje a la base para confirmarlo.
  if (!slugValido(slug)) notFound();

  return esMenu ? <CartaPagina slug={slug} /> : <Ficha slug={slug} />;
}
