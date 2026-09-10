import Link from "next/link";
import { fotoCocina, fotoEncabezado } from "../lib/fotos";
import { supabaseServer } from "../lib/supabase";
import { conFotos, guardadosDe } from "../lib/busqueda";
import { catalogoComida, rutaCocina } from "../lib/zonas";
import Nav from "./nav";
import Buscador from "./buscador";
import Orden from "./orden";
import Waitlist from "./waitlist";
import Filtros, { hrefCon, listaDe } from "./filtros";
import MapaResultados from "./mapa-resultados";
import Pie from "./pie";
import Tarjeta, { PRECIO } from "./tarjeta";
import { iconoCocina, tonoCocina } from "./cocinas";

// La portada es la búsqueda: quien llega quiere ver dónde comer, no leer
// sobre el producto. El texto de venta queda debajo, para quien baje.
const TITULO = "Menú Abierto — encuentra dónde comer, y haz que te encuentren";
const DESCRIPCION =
  "Busca restaurantes por colonia, zona, municipio o estado, o encuentra los más cercanos a ti, con su menú y sus precios de verdad.";

// La portada filtrada no se indexa, y no es un descuido: `/?cocina=tacos&
// lugar=Coyoacán` enseña lo mismo que /comida/tacos/coyoacan, y las dos
// compitiendo por la misma búsqueda es el sitio partiéndose la fuerza en dos.
// La página de zona es la que tiene título, texto y enlaces; esta es la
// herramienta, con su mapa, su orden y sus siete filtros combinables, y sus
// combinaciones no son miles de páginas que un buscador deba recorrer.
//
// `follow` va puesto: no se indexa la búsqueda filtrada, pero sí se siguen sus
// enlaces, que llevan a las fichas.
export async function generateMetadata({ searchParams }) {
  const sp = await searchParams;
  const filtrada = Object.entries(sp ?? {}).some(
    ([clave, valor]) => clave !== "vista" && typeof valor === "string" && valor !== "",
  );

  return {
    title: TITULO,
    description: DESCRIPCION,
    alternates: { canonical: "/" },
    robots: filtrada ? { index: false, follow: true } : undefined,
  };
}

// Se resuelve en cada visita, y no hace falta decirlo: la búsqueda depende de
// lo que traiga la URL y el menú de arriba de quién esté firmado, así que Next
// ya la trata como dinámica sin la directiva.

const RADIO_M = 15000;

// Seis losetas llenan una fila sin que la sección se coma la página.
const CATEGORIAS_EN_PORTADA = 6;

const OWNER = [
  {
    title: "Tú mandas en tu carta",
    body: "Cambia precios, agota un platillo o publica el menú del día desde el celular. Se ve al instante.",
    dibujo: (
      <>
        <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" />
        <path d="M14.5 6.5 17.5 9.5" />
      </>
    ),
  },
  {
    title: "Fotos y video",
    body: "Sube tus mejores imágenes y clips cortos del local y de la cocina. Es lo primero que mira quien busca.",
    dibujo: (
      <>
        <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
        <circle cx="9" cy="10.5" r="1.8" />
        <path d="M3.5 17 9 12l3.5 3 3-2.5 5 4.5" />
      </>
    ),
  },
  {
    title: "Apareces arriba",
    body: "Con Premium ganas posición destacada en las búsquedas de tu zona, perfil ampliado y estadísticas de visitas.",
    dibujo: (
      <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />
    ),
  },
];

const STEPS = [
  {
    title: "Reclama tu restaurante",
    body: "Creas tu cuenta y verificas que el negocio es tuyo. Sin costo.",
  },
  {
    title: "Publica tu menú",
    body: "Cargas platillos, precios y fotos. Puedes empezar con diez y crecer después.",
  },
  {
    title: "Mantenlo vivo",
    body: "Actualizas cuando cambien tus precios. Quien te busca ve siempre lo correcto.",
  },
];

export default async function Home({ searchParams }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const lugar = typeof sp.lugar === "string" ? sp.lugar : "";
  const cocina = typeof sp.cocina === "string" ? sp.cocina : "";
  const servicios = listaDe(sp.servicios);
  const calificacion = typeof sp.calificacion === "string" ? sp.calificacion : "";
  const abierto = sp.abierto === "1";
  const precio = Number(sp.precio) || null;
  const mapa = sp.vista === "mapa";
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const conUbicacion = Number.isFinite(lat) && Number.isFinite(lng) && sp.lat && sp.lng;
  const orden = ["relevancia", "cercanos", "calificacion"].includes(sp.orden)
    ? sp.orden
    : conUbicacion
      ? "cercanos"
      : "relevancia";

  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(sp)) {
    if (typeof valor === "string" && valor !== "") params.set(clave, valor);
  }

  let resultados = [];
  let categorias = [];
  let catalogoServicios = [];
  let slugPorNombre = new Map();
  let guardados = new Set();
  let fallo = false;

  try {
    const supabase = supabaseServer();

    const [busqueda, usadas, catalogo, listaServicios] = await Promise.all([
      supabase.rpc("search_restaurants", {
        lat: conUbicacion ? lat : null,
        lng: conUbicacion ? lng : null,
        radius_m: RADIO_M,
        cuisine_slugs: cocina ? [cocina] : null,
        amenity_slugs: servicios.length ? servicios : null,
        max_price_level: precio,
        min_rating: calificacion ? Number(calificacion) : null,
        open_now: abierto,
        search_text: q || null,
        place_text: lugar || null,
        sort_by: orden,
        result_limit: 48,
        result_offset: 0,
      }),
      // Las categorías que se ofrecen primero son las que de verdad tiene
      // alguien publicado: un filtro que siempre devuelve cero no ayuda a
      // nadie, y encabezando la fila se ve lo que sí hay.
      supabase.from("restaurant_cuisines").select("cuisines (slug, name)"),
      supabase.from("cuisines").select("slug, name").order("name"),
      supabase.from("amenities").select("slug, name, icon").order("position"),
    ]);

    if (busqueda.error) fallo = true;
    resultados = busqueda.data ?? [];
    catalogoServicios = listaServicios.data ?? [];

    const vistas = new Map();
    for (const fila of usadas.data ?? []) {
      const c = fila.cuisines;
      if (c && !vistas.has(c.slug)) vistas.set(c.slug, c.name);
    }
    for (const [slug, name] of vistas) slugPorNombre.set(name, slug);

    // Detrás de las que ya tienen restaurante va el resto del catálogo: la
    // portada de un directorio que apenas arranca no puede enseñar dos
    // categorías y un hueco.
    const enUso = [...vistas.entries()].map(([slug, name]) => ({ slug, name }));
    const resto = (catalogo.data ?? []).filter((c) => !vistas.has(c.slug));
    categorias = [...enUso, ...resto];
  } catch {
    fallo = true;
  }

  guardados = await guardadosDe(resultados);

  // Las fotos van después de la búsqueda y no dentro: son una consulta para
  // todos los resultados, y la comparte con las páginas de /comida.
  if (!fallo) resultados = await conFotos(resultados);

  // Qué categorías tienen página propia en /comida. La portada ofrece el
  // catálogo entero —incluidas las que todavía no tiene nadie—, y esas no
  // tienen página: enlazarlas sería mandar a un 404 a quien pulse la loseta, y
  // a un buscador a rastrear direcciones que no existen.
  const catalogoComidas = await catalogoComida();
  const conPagina = new Set(catalogoComidas.cocinas.map((c) => c.slug));

  const hayFiltros = Boolean(
    q || lugar || cocina || abierto || precio || calificacion || servicios.length || conUbicacion,
  );

  // La imagen del encabezado: primero la del archivo, y si no hay, la de un
  // restaurante publicado. Nada de banco de fotos escondido en el código.
  const fotoPortada = fotoEncabezado() ?? resultados.find((r) => r.foto)?.foto ?? null;

  const enPortada = categorias.slice(0, CATEGORIAS_EN_PORTADA);
  // Las zonas del filtro salen de los resultados que hay, no de un catálogo de
  // municipios: ofrecer uno donde no hay ni una ficha es un filtro que solo
  // sabe devolver cero.
  const zonas = [...new Set(resultados.map((r) => r.city).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const atajos = categorias.slice(0, 3);
  const serviciosAtajo = catalogoServicios.slice(0, 2);
  const titulo = lugar
    ? `Restaurantes en ${lugar}`
    : conUbicacion
      ? "Restaurantes cerca de ti"
      : "Restaurantes publicados";

  const vistas = (
    <div className="vistas">
      <Link
        className={mapa ? "vista" : "vista vista-on"}
        href={hrefCon(params, { vista: null })}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
        Lista
      </Link>
      <Link
        className={mapa ? "vista vista-on" : "vista"}
        href={hrefCon(params, { vista: "mapa" })}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7.5 3.5 2.5 5.5v11l5-2 5 2 5-2v-11l-5 2z" />
          <path d="M7.5 3.5v11M12.5 6.5v11" />
        </svg>
        Mapa
      </Link>
    </div>
  );

  return (
    <>
      <Nav landing />

      <header className="portada">
        <div className="portada-fondo" aria-hidden="true">
          {fotoPortada ? <img src={fotoPortada} alt="" /> : null}
        </div>

        <div className="wrap wrap-ancho portada-inner">
          <p className="portada-nota portada-nota-izq" aria-hidden="true">
            Descubre
            <br />
            Explora
            <br />
            Disfruta
          </p>
          <p className="portada-nota portada-nota-der" aria-hidden="true">
            Buena comida
            <br />
            mejores historias
          </p>

          <h1>¿Qué se te antoja hoy?</h1>
          <p className="portada-sub">
            Encuentra restaurantes, platillos y menús cerca de ti, con precios de
            verdad.
          </p>

          <Buscador q={q} lugar={lugar} conUbicacion={Boolean(conUbicacion)}>
            {vistas}
          </Buscador>
          <p className="portada-precios">
            <Link href="/precios">¿Buscas por precio? Quién vende qué, y a cuánto, cerca de ti</Link>
          </p>
        </div>
      </header>

      <div className="chips-barra">
        <div className="wrap wrap-ancho chips">
          <Link
            className={abierto ? "chip chip-on" : "chip"}
            href={hrefCon(params, { abierto: abierto ? null : "1" })}
          >
            <span className="chip-punto" aria-hidden="true" />
            Abierto ahora
          </Link>

          {serviciosAtajo.map((s) => {
            const puesto = servicios.includes(s.slug);
            return (
              <Link
                key={s.slug}
                className={puesto ? "chip chip-on" : "chip"}
                href={hrefCon(params, {
                  servicios: puesto
                    ? servicios.filter((x) => x !== s.slug).join(",")
                    : [...servicios, s.slug].join(","),
                })}
              >
                {s.name}
              </Link>
            );
          })}

          {atajos.map((c) => (
            <Link
              key={c.slug}
              className={c.slug === cocina ? "chip chip-on" : "chip"}
              href={hrefCon(params, { cocina: c.slug === cocina ? null : c.slug })}
            >
              <span aria-hidden="true">{iconoCocina(c.slug)}</span>
              {c.name}
            </Link>
          ))}

          {[1, 2, 3].map((p) => (
            <Link
              key={p}
              className={precio === p ? "chip chip-precio chip-on" : "chip chip-precio"}
              href={hrefCon(params, { precio: precio === p ? null : String(p) })}
              title={`${PRECIO[p]} o menos`}
            >
              {PRECIO[p]}
            </Link>
          ))}
        </div>
      </div>

      {enPortada.length ? (
        <section className="wrap wrap-ancho categorias-seccion">
          <div className="categorias-cabeza">
            <h2>Explora por tipo de comida</h2>
            <a href="#filtros">Ver todas las categorías</a>
          </div>
          <div className="categorias">
            {enPortada.map((c) => {
              const foto = fotoCocina(c.slug);
              return (
                <Link
                  className="categoria"
                  key={c.slug}
                  // Sin nada más puesto, la loseta lleva a la página de la
                  // categoría —/comida/tacos— y no a la portada con un filtro:
                  // es la que un buscador puede seguir, guardar y enseñar. Con
                  // filtros encima manda la búsqueda, que es lo que la persona
                  // está armando, y una categoría sin restaurantes no tiene
                  // página a la que llevar.
                  href={
                    !hayFiltros && conPagina.has(c.slug)
                      ? rutaCocina(c.slug)
                      : hrefCon(params, { cocina: c.slug })
                  }
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
                  <b>{c.name}</b>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <main className="wrap wrap-ancho resultados">
        <div className="resultados-cabeza">
          <h2>{titulo}</h2>
          <span className="resultados-cuenta">
            {resultados.length === 1 ? "1 resultado" : `${resultados.length} resultados`}
          </span>
        </div>

        <div className="resultados-rejilla">
          <div>
            {fallo ? (
              <p className="form-msg err">
                No pudimos cargar la búsqueda. Vuelve a intentarlo en un momento.
              </p>
            ) : resultados.length === 0 ? (
              <div className="vacio">
                <h2>Todavía no hay nada que coincida</h2>
                <p>
                  Menú Abierto está creciendo ciudad por ciudad. Prueba con menos
                  filtros, o escribe otra colonia o municipio.
                </p>
                <div className="vacio-acciones">
                  {hayFiltros ? (
                    <Link className="btn" href="/">
                      Ver todos los restaurantes
                    </Link>
                  ) : null}
                  <Link className={hayFiltros ? "btn-linea" : "btn"} href="/registro">
                    Publica tu restaurante
                  </Link>
                </div>
              </div>
            ) : mapa ? (
              <MapaResultados resultados={resultados} />
            ) : (
              <div className="tarjetas">
                {resultados.map((r) => (
                  <Tarjeta
                    key={r.id}
                    r={r}
                    slugCocina={slugPorNombre.get(r.cuisines?.[0])}
                    guardado={guardados.has(r.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="lateral" id="filtros">
            <div className="caja">
              <h2>Ordenar por</h2>
              <Orden valor={orden} />

              <h2>Filtros</h2>
              <Filtros
                params={params}
                categorias={categorias}
                servicios={catalogoServicios}
                zonas={zonas}
                cocina={cocina}
                serviciosActivos={servicios}
                precio={precio}
                calificacion={calificacion}
                lugar={lugar}
                hayFiltros={hayFiltros}
              />
            </div>

            <div className="promo">
              <span className="promo-hoja promo-hoja-a" aria-hidden="true">
                <svg viewBox="0 0 100 100">
                  <path d="M90 10C50 14 14 40 12 78c-1 22 10 20 24 14 3-30 18-58 54-82z" />
                </svg>
              </span>
              <span className="promo-hoja promo-hoja-b" aria-hidden="true">
                <svg viewBox="0 0 100 100">
                  <path d="M90 10C50 14 14 40 12 78c-1 22 10 20 24 14 3-30 18-58 54-82z" />
                </svg>
              </span>
              <span className="promo-icono" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 9h16l-1 11a1.5 1.5 0 0 1-1.5 1.4h-11A1.5 1.5 0 0 1 5 20z" />
                  <path d="M3.5 9 5 4.5h14L20.5 9" />
                  <path d="M9 13h6" />
                </svg>
              </span>
              <h2>¿Tienes un restaurante?</h2>
              <p>Publica tu menú gratis y llega a más clientes.</p>
              <Link className="btn" href="/registro">
                Comienza ahora
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <section className="band" id="restaurantes">
        <div className="wrap wrap-ancho section">
          <div className="section-head">
            <h2>Tu carta deja de vivir en una foto borrosa</h2>
            <p>
              La de hace dos años, la que se abre girada y no se lee. Aquí el
              menú lo controlas tú, desde tu cuenta, cuando quieras.
            </p>
          </div>
          <div className="cards">
            {OWNER.map((c) => (
              <article className="card" key={c.title}>
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    {c.dibujo}
                  </svg>
                </div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
          <div className="section-cta">
            <Link className="btn" href="/registro">
              Publica tu menú gratis
            </Link>
            <Link className="btn-linea" href="/reclamar">
              Reclama tu ficha
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap wrap-ancho section">
          <div className="section-head">
            <h2>Publicar toma una tarde</h2>
            <p>Y actualizar, menos de un minuto.</p>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band" id="lista">
        <div className="wrap wrap-ancho cta">
          <h2>Avísame cuando llegue a mi ciudad</h2>
          <p>
            Estamos armando el directorio ciudad por ciudad. Déjanos tu correo y
            te escribimos cuando toque la tuya.
          </p>
          <Waitlist />
        </div>
      </section>

      <Pie />
    </>
  );
}
