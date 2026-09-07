import { notFound } from "next/navigation";
import { menuIdValido, slugValido } from "../../lib/slug";
import Ficha, { metadataFicha } from "../_ficha/ficha";
import CartaPagina, { metadataCarta } from "../_ficha/carta-pagina";

// Esta ruta ya no se declara `force-dynamic`. Sigue resolviéndose en cada
// visita —lee la sesión para saber si quien mira es el dueño, y eso son
// cookies—, pero lo caro ya no viaja con ella: la ficha y la carta salen de lo
// que `_ficha/datos` tiene guardado, con su etiqueta para tirarlo en cuanto el
// dueño guarda algo. Antes la directiva decía "no guardes nada de aquí" y se
// llevaba por delante también las consultas.
//
// Las fichas cuelgan de la raíz: menuabierto.com/jcsmokehouse. No hay un
// prefijo que las separe del resto del sitio, así que esta ruta atrapa todo lo
// que no coincidió antes con /panel, /entrar o /api — en Next las rutas fijas
// ganan siempre a la comodín, y `lib/slug` guarda esa misma lista para que un
// restaurante no pueda quedarse con una de ellas.
//
// Un slug puede traer colonia (`tacoselgordo/centro`) y la carta cuelga de él:
// `/tacoselgordo/centro/menu` son todas las cartas y
// `/tacoselgordo/centro/menu/<id>` es una sola. Se busca el tramo "menu" en
// vez de contar tramos desde el final; "menu" está reservado como primer tramo
// y prohibido como colonia, así que solo puede ser este separador.
function leerRuta(partes) {
  const tramos = (partes ?? []).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });

  const corte = tramos.indexOf("menu");
  if (corte < 1) return { slug: tramos.join("/"), esMenu: false, menuId: null };

  const resto = tramos.slice(corte + 1);
  // Más de un tramo después de "menu" no es ninguna página nuestra.
  if (resto.length > 1) return { slug: "", esMenu: false, menuId: null };

  return {
    slug: tramos.slice(0, corte).join("/"),
    esMenu: true,
    menuId: resto[0] ?? null,
  };
}

export async function generateMetadata({ params }) {
  const { ruta } = await params;
  const { slug, esMenu, menuId } = leerRuta(ruta);
  if (!slugValido(slug)) return { title: "Menú Abierto" };
  if (menuId && !menuIdValido(menuId)) return { title: "Menú Abierto" };
  return esMenu ? metadataCarta(slug, menuId) : metadataFicha(slug);
}

export default async function Publica({ params }) {
  const { ruta } = await params;
  const { slug, esMenu, menuId } = leerRuta(ruta);

  // Una dirección con tres tramos, con mayúsculas o con guiones no es de una
  // ficha: se corta aquí en vez de gastar un viaje a la base para confirmarlo.
  if (!slugValido(slug)) notFound();
  if (menuId && !menuIdValido(menuId)) notFound();

  return esMenu ? <CartaPagina slug={slug} menuId={menuId} /> : <Ficha slug={slug} />;
}
