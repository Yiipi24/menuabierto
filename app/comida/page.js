import Link from "next/link";
import { metaCompartir } from "../../lib/compartir";
import { fotoCocina } from "../../lib/fotos";
import { jsonLdListado } from "../../lib/jsonld";
import { SITIO, urlDelSitio } from "../../lib/sitio";
import { catalogoComida, rutaCocina, rutaZona } from "../../lib/zonas";
import DatosEstructurados from "../_ficha/datos-estructurados";
import Nav from "../nav";
import Pie from "../pie";
import { iconoCocina, tonoCocina } from "../cocinas";

// El índice de /comida: de qué se come y dónde. Es la página de la que cuelgan
// todas las demás de esta rama, y la única entrada por la que un rastreador
// puede llegar a una zona sin pasar por el sitemap.
//
// Solo enseña lo que existe. Una cocina sin un restaurante publicado no tiene
// página, así que tampoco tiene loseta aquí.

const TITULO = "Dónde comer, por tipo de comida y por zona | Menú Abierto";
const DESCRIPCION =
  "Tacos, mariscos, birria o pizza, en la colonia o el municipio donde estés. Los restaurantes que ya publicaron su carta en Menú Abierto, con sus precios de verdad.";

// Las zonas que se enseñan sueltas al final: las que más restaurantes tienen.
// No están todas a propósito —el sitemap sí las lleva todas— porque una página
// que es una lista de doscientos enlaces no la lee nadie.
const ZONAS_DESTACADAS = 18;

export const metadata = metaCompartir({
  titulo: TITULO,
  descripcion: DESCRIPCION,
  ruta: "/comida",
});

export default async function ComidaPagina() {
  const catalogo = await catalogoComida();
  const destacadas = catalogo.combos.slice(0, ZONAS_DESTACADAS);

  return (
    <>
      <Nav />

      <main className="wrap wrap-ancho listado">
        <nav className="migas" aria-label="Dónde estás">
          <span>
            <Link href="/">Inicio</Link>
            <span className="migas-sep" aria-hidden="true">
              ›
            </span>
          </span>
          <span>
            <b aria-current="page">Comida</b>
          </span>
        </nav>

        <header className="listado-cabeza">
          <div>
            <h1>Dónde comer, por tipo de comida</h1>
            <p className="listado-intro">
              Cada cocina con los restaurantes que ya publicaron su carta, y cada
              zona con lo que hay en ella. Los precios son los que cobran hoy,
              puestos por el propio restaurante.
            </p>
          </div>
        </header>

        {catalogo.cocinas.length ? (
          <section className="categorias-seccion">
            <div className="categorias-cabeza">
              <h2>Tipos de comida</h2>
            </div>
            <div className="categorias">
              {catalogo.cocinas.map((c) => {
                const foto = fotoCocina(c.slug);
                return (
                  <Link
                    className="categoria"
                    key={c.slug}
                    href={rutaCocina(c.slug)}
                    style={{ "--categoria-tono": tonoCocina(c.slug) }}
                  >
                    <span className="categoria-foto">
                      {foto ? <img src={foto} alt="" loading="lazy" /> : null}
                    </span>
                    {foto ? null : (
                      <span className="categoria-icono" aria-hidden="true">
                        {iconoCocina(c.slug)}
                      </span>
                    )}
                    <b>{c.nombre}</b>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="vacio">
            <h2>Todavía no hay restaurantes publicados</h2>
            <p>
              Menú Abierto está creciendo ciudad por ciudad. En cuanto haya
              fichas publicadas, esta página se llena sola.
            </p>
            <div className="vacio-acciones">
              <Link className="btn" href="/registro">
                Publica tu restaurante
              </Link>
            </div>
          </div>
        )}

        {destacadas.length ? (
          <section className="vecinas">
            <h2>Por zona</h2>
            <div className="vecinas-lista">
              {destacadas.map((c) => (
                <Link className="chip" key={`${c.cocina}|${c.zona}`} href={rutaZona(c.cocina, c.zona)}>
                  <span aria-hidden="true">{iconoCocina(c.cocina)}</span>
                  {c.cocinaNombre} en {c.zonaNombre}
                  <span className="vecinas-cuenta">{c.total}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <Pie />

      <DatosEstructurados
        datos={jsonLdListado({
          titulo: TITULO,
          descripcion: DESCRIPCION,
          ruta: "/comida",
          migas: [
            { nombre: "Menú Abierto", url: SITIO },
            { nombre: "Comida", url: urlDelSitio("/comida") },
          ],
        })}
      />
    </>
  );
}
