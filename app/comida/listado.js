import Link from "next/link";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { TAG_RUTAS, VIGENCIA_FICHA } from "../../lib/cache";
import { imagenesDeCompartir, metaCompartir } from "../../lib/compartir";
import { fotoCocina } from "../../lib/fotos";
import { jsonLdListado } from "../../lib/jsonld";
import { conFotos, guardadosDe } from "../../lib/busqueda";
import { supabaseServer } from "../../lib/supabase";
import { SITIO, urlDelSitio } from "../../lib/sitio";
import {
  catalogoComida,
  cocinaDe,
  cocinasDeZona,
  comboDe,
  esDeLaZona,
  rutaBusqueda,
  rutaCocina,
  rutaZona,
  tramoValido,
  zonasDeCocina,
} from "../../lib/zonas";
import DatosEstructurados from "../_ficha/datos-estructurados";
import Nav from "../nav";
import Pie from "../pie";
import Tarjeta from "../tarjeta";
import { iconoCocina, tonoCocina } from "../cocinas";

// La página que ve quien buscó "tacos en Coyoacán". Es la misma búsqueda de la
// portada, pero contada como una página: un título que dice de qué va, un
// texto que un buscador puede leer, y enlaces a las zonas y las cocinas
// vecinas para que el directorio se recorra solo.
//
// Sirve a las dos direcciones —/comida/tacos y /comida/tacos/coyoacan— porque
// son la misma página con una vuelta de tuerca más. Escribirlas por separado
// era escribir dos veces el mismo listado.

// Cuántos restaurantes caben antes de que la página deje de ser una lista y se
// vuelva un directorio entero. Quien llega buscando dónde comer no baja de
// cuarenta y ocho tarjetas, y para eso está "afinar la búsqueda".
const TOPE = 48;

// Cuántos enlaces de zonas o de cocinas hermanas se ofrecen abajo. Suficientes
// para que un rastreador encuentre el resto del directorio, pocos para que la
// página no acabe siendo una lista de enlaces con tres tarjetas arriba.
const VECINOS = 12;

/**
 * Resuelve la dirección contra el catálogo. Devuelve `null` cuando la página
 * no existe —una cocina sin restaurantes publicados, una zona donde esa cocina
 * no está—, que es lo que se convierte en 404.
 *
 * Es importante que sea `null` y no una página vacía: /comida/sushi/tepic sin
 * un solo restaurante de sushi en Tepic no es una página, es una promesa
 * incumplida, y publicar todas las que se pueden escribir es exactamente lo
 * que Google llama doorway pages.
 */
async function resolver(cocinaSlug, zonaSlug) {
  if (!tramoValido(cocinaSlug)) return null;
  if (zonaSlug != null && !tramoValido(zonaSlug)) return null;

  const catalogo = await catalogoComida();
  const cocina = cocinaDe(catalogo, cocinaSlug);
  if (!cocina) return null;

  if (zonaSlug == null) return { catalogo, cocina, combo: null };

  const combo = comboDe(catalogo, cocinaSlug, zonaSlug);
  return combo ? { catalogo, cocina, combo } : null;
}

// El título, el texto y la dirección de la página, en un solo sitio: los usan
// el `<title>`, el `<h1>`, la descripción que sale en Google y los datos
// estructurados, y con cuatro copias acaban diciendo cuatro cosas distintas.
function textos({ cocina, combo }) {
  const zona = combo?.zonaNombre ?? null;
  const dondeLargo = zona ? `${zona}${combo.estado ? `, ${combo.estado}` : ""}` : null;

  if (!zona) {
    return {
      ruta: rutaCocina(cocina.slug),
      h1: `Restaurantes de ${cocina.nombre}`,
      titulo: `${cocina.nombre} — restaurantes y menús | Menú Abierto`,
      tituloCorto: `${cocina.nombre} en Menú Abierto`,
      descripcion: `Los restaurantes de ${cocina.nombre} publicados en Menú Abierto, con su carta, sus precios de verdad y la zona donde están.`,
      intro: `Estos son los restaurantes de ${cocina.nombre} que ya publicaron su carta en Menú Abierto. Cada uno con sus platillos y sus precios, para decidir antes de salir de casa.`,
    };
  }

  return {
    ruta: rutaZona(cocina.slug, combo.zona),
    h1: `${cocina.nombre} en ${zona}`,
    titulo: `${cocina.nombre} en ${zona} — restaurantes y menús | Menú Abierto`,
    tituloCorto: `${cocina.nombre} en ${zona}`,
    descripcion: `Dónde comer ${cocina.nombre} en ${dondeLargo}: los restaurantes que ya publicaron su menú en Menú Abierto, con precios, horarios y cómo llegar.`,
    intro: `Los restaurantes de ${cocina.nombre} en ${dondeLargo} que ya publicaron su carta en Menú Abierto. Ves los platillos y lo que cuestan antes de salir de casa, con el horario de hoy y cómo llegar.`,
  };
}

export async function metadataListado(cocinaSlug, zonaSlug = null) {
  const resuelto = await resolver(cocinaSlug, zonaSlug);
  if (!resuelto) return { title: "Página no encontrada — Menú Abierto" };

  const { cocina, combo } = resuelto;
  const { ruta, titulo, tituloCorto, descripcion } = textos({ cocina, combo });
  const foto = fotoCocina(cocina.slug);

  return metaCompartir({
    titulo,
    tituloCorto,
    descripcion,
    ruta,
    // La foto de la categoría es lo único que esta página tiene de suyo; sin
    // ella hereda la del sitio, que es lo que hacen las demás.
    imagenes: foto
      ? [{ url: urlDelSitio(foto), alt: cocina.nombre }]
      : imagenesDeCompartir(),
  });
}

/**
 * La lista de una página, guardada una hora.
 *
 * Es la misma decisión que la ficha: estas páginas se resuelven en cada visita
 * —el menú de arriba depende de quién entró—, pero lo caro no viaja con ellas.
 * La búsqueda y las fotos salen de la caché de datos, con la etiqueta `rutas`,
 * así que un restaurante que se publica aparece hoy y no dentro de una hora, y
 * un rastreador recorriendo doscientas zonas no cuesta doscientas búsquedas.
 *
 * Lo que no se guarda es quién está mirando: los corazones se piden aparte, ya
 * fuera de esto.
 */
const buscarGuardado = unstable_cache(
  async (cocinaSlug, zonaNombre) => {
    const supabase = supabaseServer();
    const { data, error } = await supabase.rpc("search_restaurants", {
      cuisine_slugs: [cocinaSlug],
      // El nombre de la zona acota en la base lo que luego se aprieta abajo:
      // sin esto habría que traerse el directorio entero para quedarse con
      // seis restaurantes.
      place_text: zonaNombre,
      sort_by: "relevancia",
      result_limit: TOPE,
      result_offset: 0,
    });
    if (error) throw error;

    // "Abierto ahora" no sobrevive a una hora guardada: mandaría a alguien a un
    // local cerrado. Es lo único de la tarjeta que cambia sin que nadie la
    // toque, y la búsqueda de la portada —que sí se resuelve en cada visita—
    // sigue enseñándolo.
    return (await conFotos(data ?? [])).map((r) => ({ ...r, is_open_now: false }));
  },
  ["listado-comida"],
  { revalidate: VIGENCIA_FICHA, tags: [TAG_RUTAS] },
);

async function buscar({ cocina, combo }) {
  try {
    const filas = await buscarGuardado(cocina.slug, combo?.zonaNombre ?? null);
    // La base busca el nombre de la zona dentro de colonia, municipio, estado
    // y código postal, y eso es de más para esta página: "Centro" traería el
    // Centro de cualquier ciudad. Aquí se aprieta contra el tramo exacto de la
    // dirección, que es de lo que la página dice hablar.
    return {
      resultados: combo ? filas.filter((r) => esDeLaZona(r, combo.zona)) : filas,
      fallo: false,
    };
  } catch {
    return { resultados: [], fallo: true };
  }
}

function Migas({ cocina, combo }) {
  const pasos = [
    { nombre: "Inicio", url: "/" },
    { nombre: "Comida", url: "/comida" },
    { nombre: cocina.nombre, url: rutaCocina(cocina.slug) },
  ];
  if (combo) pasos.push({ nombre: combo.zonaNombre, url: rutaZona(cocina.slug, combo.zona) });

  return (
    <nav className="migas" aria-label="Dónde estás">
      {pasos.map((paso, i) => {
        const ultimo = i === pasos.length - 1;
        return (
          <span key={paso.url}>
            {ultimo ? (
              <b aria-current="page">{paso.nombre}</b>
            ) : (
              <Link href={paso.url}>{paso.nombre}</Link>
            )}
            {ultimo ? null : (
              <span className="migas-sep" aria-hidden="true">
                ›
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// Las listas de abajo: "También hay tacos en…" y "En Coyoacán también hay…".
// No son adorno. Son lo que hace que una zona nueva se descubra desde las que
// ya existen, sin depender de que alguien las enlace desde fuera.
function Vecinas({ titulo, enlaces }) {
  if (!enlaces.length) return null;

  return (
    <section className="vecinas">
      <h2>{titulo}</h2>
      <div className="vecinas-lista">
        {enlaces.map((e) => (
          <Link className="chip" key={e.href} href={e.href}>
            {e.icono ? <span aria-hidden="true">{e.icono}</span> : null}
            {e.texto}
            <span className="vecinas-cuenta">{e.total}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function Listado({ cocina: cocinaSlug, zona: zonaSlug = null }) {
  const resuelto = await resolver(cocinaSlug, zonaSlug);
  if (!resuelto) notFound();

  const { catalogo, cocina, combo } = resuelto;
  const { ruta, h1, titulo, descripcion, intro } = textos({ cocina, combo });

  const { resultados, fallo } = await buscar({ cocina, combo });
  const guardados = await guardadosDe(resultados);

  // El slug de la cocina de cada tarjeta sale del catálogo: la búsqueda
  // devuelve los nombres, y el ícono y el color se buscan por slug.
  const slugPorNombre = new Map(catalogo.cocinas.map((c) => [c.nombre, c.slug]));

  const otrasZonas = zonasDeCocina(catalogo, cocina.slug)
    .filter((c) => c.zona !== combo?.zona)
    .slice(0, VECINOS)
    .map((c) => ({
      href: rutaZona(cocina.slug, c.zona),
      texto: c.zonaNombre,
      total: c.total,
    }));

  const otrasCocinas = (
    combo ? cocinasDeZona(catalogo, combo.zona) : catalogo.combos
  )
    .filter((c) => c.cocina !== cocina.slug)
    .slice(0, VECINOS)
    .map((c) => ({
      href: combo ? rutaZona(c.cocina, combo.zona) : rutaCocina(c.cocina),
      texto: combo ? c.cocinaNombre : `${c.cocinaNombre} en ${c.zonaNombre}`,
      icono: iconoCocina(c.cocina),
      total: c.total,
    }));

  const migas = [
    { nombre: "Menú Abierto", url: SITIO },
    { nombre: "Comida", url: urlDelSitio("/comida") },
    { nombre: cocina.nombre, url: urlDelSitio(rutaCocina(cocina.slug)) },
  ];
  if (combo) migas.push({ nombre: combo.zonaNombre, url: urlDelSitio(ruta) });

  const foto = fotoCocina(cocina.slug);

  return (
    <>
      <Nav />

      <main className="wrap wrap-ancho listado">
        <Migas cocina={cocina} combo={combo} />

        <header className="listado-cabeza" style={{ "--categoria-tono": tonoCocina(cocina.slug) }}>
          <span className="listado-marca" aria-hidden="true">
            {foto ? <img src={foto} alt="" /> : <span>{iconoCocina(cocina.slug)}</span>}
          </span>
          <div>
            <h1>{h1}</h1>
            <p className="listado-intro">{intro}</p>
          </div>
        </header>

        <div className="resultados-cabeza">
          <h2>
            {combo ? `Restaurantes en ${combo.zonaNombre}` : "Restaurantes publicados"}
          </h2>
          <span className="resultados-cuenta">
            {resultados.length === 1 ? "1 restaurante" : `${resultados.length} restaurantes`}
          </span>
        </div>

        {fallo ? (
          <p className="form-msg err">
            No pudimos cargar la lista. Vuelve a intentarlo en un momento.
          </p>
        ) : resultados.length ? (
          <div className="tarjetas">
            {resultados.map((r) => (
              <Tarjeta
                key={r.id}
                r={r}
                slugCocina={slugPorNombre.get(r.cuisines?.[0]) ?? cocina.slug}
                guardado={guardados.has(r.id)}
              />
            ))}
          </div>
        ) : (
          // El catálogo se guarda un día, así que una ficha que se ocultó hace
          // un rato puede dejar la página en pie sin nada dentro. Se dice, y se
          // ofrece por dónde seguir, en vez de enseñar un hueco.
          <div className="vacio">
            <h2>Aquí no queda nada por ahora</h2>
            <p>
              Los restaurantes de {cocina.nombre}
              {combo ? ` en ${combo.zonaNombre}` : ""} que había dejaron de estar
              publicados. Prueba en otra zona, o mira la búsqueda completa.
            </p>
            <div className="vacio-acciones">
              <Link className="btn" href="/">
                Ver todos los restaurantes
              </Link>
              <Link className="btn-linea" href="/registro">
                Publica tu restaurante
              </Link>
            </div>
          </div>
        )}

        <p className="listado-afinar">
          <Link href={rutaBusqueda(cocina.slug, combo?.zonaNombre ?? null)}>
            Afinar esta búsqueda con mapa, precio y servicios →
          </Link>
        </p>

        <Vecinas
          titulo={combo ? `${cocina.nombre} en otras zonas` : `Dónde hay ${cocina.nombre}`}
          enlaces={otrasZonas}
        />
        <Vecinas
          titulo={combo ? `Otras cocinas en ${combo.zonaNombre}` : "Otras cocinas"}
          enlaces={otrasCocinas}
        />
      </main>

      <Pie />

      <DatosEstructurados
        datos={jsonLdListado({
          titulo,
          descripcion,
          ruta,
          migas,
          restaurantes: resultados,
        })}
      />
    </>
  );
}
