import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import { rutaFicha, rutaMenu, rutaMenuCarta } from "../../lib/slug";
import { descripcionDeMenu } from "../../lib/menus";
import { imagenesDeCompartir, metaCompartir } from "../../lib/compartir";
import { jsonLdFicha } from "../../lib/jsonld";
import { proximaApertura } from "../../lib/apertura";
import { ordenarParaLaFicha, seSirveAhora, textoDeHorario } from "../../lib/horarios-menu";
import DatosEstructurados from "./datos-estructurados";
import Nav from "../nav";
import Subnav from "./subnav";
import Hero from "./hero";
import Favoritos from "./favoritos";
import Promocion from "./promocion";
import NovedadHoy from "./novedad-hoy";
import Informacion from "./informacion";
import BarraMovil from "./barra-movil";
import Resenas from "./resenas";
import Historias from "../_social/historias";
import NoReclamada from "./no-reclamada";
import { cargarSocial, recogerHistoriasViejas } from "../_social/datos";
import { MedirVista } from "../medir";
import { IconoEstrella, IconoFlechaAtras } from "./iconos";
import {
  cargar,
  cargarPublico,
  diaLocal,
  direccionDe,
  repiteDireccion,
  resenasEscritas,
  PRECIO,
} from "./datos";

export async function metadataFicha(slug) {
  try {
    // El `<title>` y la foto que se comparte salen de lo guardado: es la misma
    // entrada que va a leer el cuerpo de la página un momento después.
    const datos = await cargarPublico(slug);
    if (!datos) return { title: "Restaurante no encontrado — Menú Abierto" };
    const { r, fotos } = datos;
    const lugar = [r.neighborhood, r.city].filter(Boolean).join(", ");
    const descripcion =
      r.summary || `Menú, precios y ubicación de ${r.name}${lugar ? ` en ${lugar}` : ""}.`;

    // La foto que se comparte es la primera de la ficha, y `cargar` ya puso la
    // fachada ahí delante: es la que se reconoce al llegar al local, y por lo
    // tanto la que hace que un enlace en un grupo de WhatsApp se entienda de
    // un vistazo.
    return metaCompartir({
      titulo: `${r.name} — menú y precios | Menú Abierto`,
      tituloCorto: lugar ? `${r.name} — ${lugar}` : r.name,
      descripcion,
      ruta: rutaFicha(slug),
      imagenes: imagenesDeCompartir(fotos, `Fachada de ${r.name}`),
    });
  } catch {
    return { title: "Menú Abierto" };
  }
}

// Cuántas fotos van en "Favoritos de la casa" cuando el dueño no marcó
// ninguna: las tres primeras de platillos, que es lo que la galería vieja
// enseñaba en tiras chicas.
const FAVORITOS_POR_DEFECTO = 3;

// La ficha pública de un restaurante.
//
// Es su página dentro de Menú Abierto: el encabezado con la fachada y la
// pared oscura, los platillos grandes, la promoción y la carta, lo que publicó
// hoy, la franja con horarios y contacto, y las reseñas. Cada pieza vive en su
// componente y aquí solo se arma lo que cada una necesita a partir de una
// sola carga de datos.
export default async function Ficha({ slug }) {
  let datos = null;
  try {
    datos = await cargar(slug);
  } catch {
    datos = null;
  }
  if (!datos) notFound();

  const {
    r,
    cocinas,
    horarios,
    fotos,
    menus,
    abierto,
    resenas,
    destacados,
    redes,
    pagos,
    servicios,
    cerrados,
    pedidos,
    cupones,
  } = datos;

  // La ficha es publica, asi que la sesion puede no existir. Solo sirve para
  // decidir que se ve bajo las resenas: el formulario, la puerta de entrada o
  // el aviso al dueno.
  const usuario = await currentUser();
  const esDueno = Boolean(usuario && r.owner_id === usuario.id);
  // Sin dueño es una ficha que sembramos nosotros (del DENUE del INEGI) y que
  // el negocio todavía no confirmó. Se dice arriba, antes de que nadie lea la
  // dirección como si la hubiera publicado el restaurante.
  const noReclamada = r.owner_id === null;

  // Cuántas reseñas lleva quien está leyendo: es lo que convierte el formulario
  // en una meta ("te falta una para Catador") en vez de un cuadro de texto.
  const misResenas = esDueno ? 0 : await resenasEscritas(usuario?.id ?? null);

  // Historias, publicaciones y mi relación con la ficha. Va aparte de `cargar`
  // porque `cargar` corre con el cliente anónimo —la ficha es igual para
  // todos— y esto depende de quién mira. Un fallo aquí no tumba la página: los
  // horarios y el menú son lo que la persona vino a ver.
  let social = {
    historias: [],
    publicaciones: [],
    hayMasPublicaciones: false,
    sigo: false,
    alerta: false,
  };
  try {
    social = await cargarSocial(r.id, usuario?.id ?? null);
  } catch (error) {
    console.error("social de la ficha", error);
  }

  // La barredora de historias caducadas viaja de aventón con las visitas: es
  // donde hay tráfico, y así no hace falta un cron para borrar filas que las
  // lecturas ya esconden.
  recogerHistoriasViejas(usuario?.id ?? null);

  const volverAqui = rutaFicha(slug);
  const direccion = direccionDe(r);
  const hayMenu = menus.length > 0;

  // El orden no es el que puso el dueño a secas: primero la carta principal,
  // luego las que se están sirviendo a esta hora y al final las que no. Quien
  // abre la ficha a las nueve de la noche viene por la cena, y tener el menú
  // de desayuno hasta arriba lo obliga a leer tres cartas para descartar dos.
  const cartas = ordenarParaLaFicha(menus, r.timezone).map((m) => ({
    id: m.id,
    nombre: m.name,
    descripcion: descripcionDeMenu(m),
    horario: textoDeHorario(m),
    sirviendo: seSirveAhora(m, r.timezone),
    principal: Boolean(m.isPrimary),
    href: rutaMenuCarta(slug, m.id),
  }));
  // A dónde lleva "Ver menú" cuando hay un solo destino que ofrecer: la carta
  // principal si hay varias, o la única.
  const hrefMenu = hayMenu
    ? cartas.length === 1
      ? cartas[0].href
      : (cartas.find((c) => c.principal)?.href ?? rutaMenu(slug))
    : null;

  // La fachada encabeza; los favoritos son las fotos que el dueño marcó como
  // destacadas y, mientras no marque ninguna, las primeras de platillos. Así
  // una ficha de antes de los nombres sigue teniendo su galería.
  const portada = fotos[0] ?? null;
  const marcadas = fotos.filter((f) => f.isFeatured);
  const favoritos = marcadas.length
    ? marcadas
    : fotos.filter((f) => f !== portada && f.category !== "fachada").slice(0, FAVORITOS_POR_DEFECTO);

  // Los destacados los escribe el dueño con su icono. Mientras no ponga
  // ninguno se cae a sus cocinas, que es lo que la ficha mostraba antes: una
  // fila vacía se vería peor que una genérica.
  const tiraDestacados = destacados.length
    ? destacados
    : cocinas.slice(0, 3).map((c) => ({ icon: "cubiertos", text: c }));

  // El día cerrado no tiene fila de horas, así que se arma la semana completa:
  // "Cerrado" dicho a propósito informa más que un día que no aparece.
  const hoy = diaLocal(r.timezone);
  const semana = [1, 2, 3, 4, 5, 6, 0]
    .map((dia) => ({
      dia,
      cerrado: cerrados.includes(dia),
      tramos: horarios.filter((h) => h.weekday === dia),
    }))
    .filter((d) => d.cerrado || d.tramos.length);

  // La descripción se calla cuando solo repite la dirección: es el caso más
  // común y hacía que la misma línea saliera tres veces en la ficha.
  const descripcion = r.description && !repiteDireccion(r.description, r) ? r.description : null;

  // La línea bajo el nombre: las cocinas, o el resumen cuando no hay. Si las
  // cocinas ya ocupan la línea, el resumen pasa a ser la nota a mano.
  const tipo = cocinas.length ? cocinas.join(" · ") : r.summary || "Restaurante";
  const nota = cocinas.length && r.summary && r.summary !== tipo ? r.summary : null;

  const apertura = proximaApertura(horarios, r.timezone, abierto)?.texto ?? null;

  const hayInformacion =
    semana.length || r.phone || r.website || pedidos || redes.length || pagos.length || servicios.length || descripcion;

  // Solo las secciones que existen entran a la barra: un enlace a "Novedades"
  // en una ficha sin publicaciones no lleva a ningún lado.
  const secciones = [
    { id: "inicio", nombre: "Inicio" },
    favoritos.length ? { id: "platillos", nombre: "Platillos" } : null,
    { id: "menu", nombre: "Menú" },
    social.publicaciones.length ? { id: "novedades", nombre: "Novedades" } : null,
    { id: "resenas", nombre: "Reseñas" },
    hayInformacion ? { id: "informacion", nombre: "Información" } : null,
  ].filter(Boolean);

  const novedad = social.publicaciones.length ? (
    <NovedadHoy
      publicaciones={social.publicaciones}
      hayMas={social.hayMasPublicaciones}
      restauranteId={r.id}
      nombre={r.name}
      slug={slug}
      volverA={volverAqui}
    />
  ) : null;

  return (
    <>
      <Nav />
      <Subnav secciones={secciones} />

      <main className="ficha ficha-editorial">
        <DatosEstructurados datos={jsonLdFicha(datos, slug)} />
        <MedirVista slug={slug} />

        <Hero
          slug={slug}
          r={r}
          portada={portada}
          tipo={tipo}
          nota={nota}
          precio={r.price_level ? PRECIO[r.price_level] : null}
          abierto={abierto}
          apertura={apertura}
          hayHorarios={horarios.length > 0}
          destacados={tiraDestacados}
          direccion={direccion}
          pedidos={pedidos}
          social={social}
          volverA={volverAqui}
        />

        {noReclamada ? <NoReclamada restauranteId={r.id} nombre={r.name} fuente={r.source} /> : null}

        {/* Las historias van justo bajo el encabezado: son el "qué hay hoy" y
            se miran de pasada. Si no hay ninguna, el componente no pinta nada. */}
        {social.historias.length ? (
          <div className="wrap wrap-ficha">
            <Historias historias={social.historias} nombre={r.name} volverA={volverAqui} />
          </div>
        ) : null}

        <Favoritos
          slug={slug}
          nombre={r.name}
          fotos={favoritos}
          hayMenu={hayMenu}
          hrefMenu={hrefMenu}
        />

        <Promocion
          slug={slug}
          cupones={cupones}
          cartas={cartas}
          tituloCartas={menus.length > 1 ? "Nuestros menús" : "Nuestro menú"}
          novedad={novedad}
          nota={
            /* El QR no se pinta en la ficha pública: quien la está viendo ya
               llegó, y el que tiene que imprimirlo es el dueño. Vive en su
               panel, donde puede bajarlo en PNG y en SVG. */
            esDueno ? (
              <p className="ficha-menu-nota">
                Tu restaurante tiene un solo código QR y esta es la página que abre. No
                cambia nunca, así que se imprime una vez y sigue sirviendo aunque cambies de
                menús o de precios. Lo descargas en <Link href={`/panel/${r.id}/qr`}>tu QR</Link>.
              </p>
            ) : null
          }
        />

        <Informacion
          slug={slug}
          r={r}
          semana={semana}
          hoy={hoy}
          abierto={abierto}
          redes={redes}
          pagos={pagos}
          servicios={servicios}
          pedidos={pedidos}
          descripcion={descripcion}
          volverA={volverAqui}
        />

        {/* Las reseñas cierran la página y toman la ventana completa: son la
            segunda razón por la que se abre una ficha. */}
        <section className="resenas-banda" id="resenas">
          <div className="wrap wrap-ficha">
            <header className="resenas-banda-encabezado">
              <div>
                <h2>
                  <IconoEstrella ancho={26} />
                  Reseñas
                </h2>
                <p>Lo que dicen nuestros clientes</p>
              </div>
              {esDueno ? null : (
                <a className="btn resenas-cta" href="#escribir-resena">
                  {resenas.length ? "Escribir una reseña" : "Escribe la primera reseña"}
                </a>
              )}
            </header>

            <Resenas
              slug={slug}
              restaurante={r}
              resenas={resenas}
              usuarioId={usuario?.id ?? null}
              esDueno={esDueno}
              misResenas={misResenas}
            />
          </div>
        </section>

        <div className="wrap wrap-ficha ficha-salida">
          <Link className="ficha-volver" href="/">
            <IconoFlechaAtras ancho={18} />
            Volver a la búsqueda
          </Link>
        </div>
      </main>

      <BarraMovil
        slug={slug}
        nombre={r.name}
        pedidos={pedidos}
        hrefMenu={hrefMenu}
        volverA={volverAqui}
      />

      <footer className="footer">
        <div className="wrap footer-inner">
          <span>© {new Date().getFullYear()} Menú Abierto</span>
          <a href="mailto:hola@menuabierto.com">hola@menuabierto.com</a>
        </div>
      </footer>
    </>
  );
}
