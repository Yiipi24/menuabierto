import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { currentUser } from "../../../lib/supabase";
import { qrRuta } from "../../../lib/qr";
import Brand from "../../brand";
import Resenas from "./resenas";
import { cargar, diaLocal, direccionDe, hora, repiteDireccion, DIAS, PRECIO } from "./datos";
import { IconoDestacado } from "../../destacados";
import { IconoRed } from "../../redes-iconos";
import {
  IconoCompartir,
  IconoCubiertos,
  IconoEscudo,
  IconoEstrella,
  IconoFlecha,
  IconoFlechaAtras,
  IconoEnlaceExterno,
  IconoGlobo,
  IconoPin,
  IconoReloj,
  IconoTarjeta,
  IconoTelefono,
} from "./iconos";

export const dynamic = "force-dynamic";

// El QR tiene que apuntar a un dominio, no a `/r/algo`: quien lo escanea lo
// hace desde otro aparato y una ruta relativa ahí no significa nada. El host de
// la petición es el que sirve la página, así que funciona igual en producción,
// en una vista previa y en local.
async function urlAbsoluta(ruta) {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return ruta;
  const protocolo = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}${ruta}`;
}

function Qr({ texto, titulo }) {
  const { d, lado, margen } = qrRuta(texto);
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${lado} ${lado}`}
      role="img"
      aria-label={titulo}
      shapeRendering="crispEdges"
    >
      <rect width={lado} height={lado} fill="#ffffff" />
      <g transform={`translate(${margen} ${margen})`} fill="var(--ink)">
        <path d={d} />
      </g>
    </svg>
  );
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const datos = await cargar(slug);
    if (!datos) return { title: "Restaurante no encontrado — Menú Abierto" };
    const { r } = datos;
    const lugar = [r.neighborhood, r.city].filter(Boolean).join(", ");
    return {
      title: `${r.name} — menú y precios | Menú Abierto`,
      description:
        r.summary || `Menú, precios y ubicación de ${r.name}${lugar ? ` en ${lugar}` : ""}.`,
    };
  } catch {
    return { title: "Menú Abierto" };
  }
}

export default async function Ficha({ params }) {
  const { slug } = await params;

  let datos = null;
  try {
    datos = await cargar(slug);
  } catch {
    datos = null;
  }
  if (!datos) notFound();

  const { r, cocinas, horarios, fotos, menus, abierto, resenas, destacados, redes, cerrados } =
    datos;

  // La ficha es publica, asi que la sesion puede no existir. Solo sirve para
  // decidir que se ve bajo las resenas: el formulario, la puerta de entrada o
  // el aviso al dueno.
  const usuario = await currentUser();
  const esDueno = Boolean(usuario && r.owner_id === usuario.id);

  const direccion = direccionDe(r);
  const rutaMenu = `/r/${encodeURIComponent(slug)}/menu`;
  const urlMenu = await urlAbsoluta(rutaMenu);
  const hayMenu = menus.length > 0;

  // Una foto grande y el resto en tiras chicas. Antes las seis salían del mismo
  // tamaño y empujaban el menú fuera de la primera pantalla.
  const portada = fotos[0] ?? null;
  const secundarias = fotos.slice(1, 5);

  // Los destacados los escribe el dueño con su icono. Mientras no ponga
  // ninguno se cae a sus cocinas, que es lo que la ficha mostraba antes: una
  // fila vacía se vería peor que una genérica.
  const tiraDestacados = destacados.length
    ? destacados
    : cocinas.slice(0, 3).map((c) => ({ icon: "cubiertos", text: c }));

  // El día cerrado no tiene fila de horas, así que se arma la semana completa:
  // "Cerrado" dicho a propósito informa más que un día que no aparece.
  // El día de hoy se marca en la lista: quien abre la ficha casi siempre viene
  // a preguntar por hoy y no por el jueves.
  const hoy = diaLocal(r.timezone);

  const semana = [1, 2, 3, 4, 5, 6, 0].map((dia) => ({
    dia,
    cerrado: cerrados.includes(dia),
    tramos: horarios.filter((h) => h.weekday === dia),
  })).filter((d) => d.cerrado || d.tramos.length);

  // La descripción se calla cuando solo repite la dirección: es el caso más
  // común y hacía que la misma línea saliera tres veces en la ficha.
  const descripcion = r.description && !repiteDireccion(r.description, r) ? r.description : null;

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

      <main className="ficha">
        <div className="wrap">
          <Link className="ficha-volver" href="/">
            <IconoFlechaAtras ancho={18} />
            Volver a la búsqueda
          </Link>

          <header className={portada ? "ficha-hero" : "ficha-hero ficha-hero-sinfoto"}>
            <div className="ficha-hero-texto">
              <h1>{r.name}</h1>
              <p className="ficha-tipo">
                {cocinas.length ? cocinas.join(" · ") : r.summary || "Restaurante"}
                {r.price_level ? ` · ${PRECIO[r.price_level]}` : ""}
              </p>
              <p className="ficha-meta">
                {abierto ? (
                  <span className="ficha-abierto">Abierto ahora</span>
                ) : horarios.length ? (
                  <span className="ficha-cerrado">Cerrado ahora</span>
                ) : null}
                {r.rating_count > 0 && r.rating_avg ? (
                  <a className="ficha-resenas-enlace" href="#resenas">
                    ★ {r.rating_avg} · {r.rating_count}{" "}
                    {r.rating_count === 1 ? "reseña" : "reseñas"}
                  </a>
                ) : (
                  <a className="ficha-sinresenas" href="#resenas">
                    Aún sin reseñas · escribe la primera
                  </a>
                )}
              </p>

              {tiraDestacados.length ? (
                <ul className="ficha-destacados">
                  {tiraDestacados.map((d, i) => (
                    <li key={`${d.text}-${i}`}>
                      <IconoDestacado slug={d.icon} ancho={22} />
                      <span>{d.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {portada ? (
              <figure className="ficha-hero-foto">
                <img src={portada.url} alt={portada.alt ?? `Foto de ${r.name}`} />
              </figure>
            ) : null}
          </header>

          {secundarias.length ? (
            <div className="ficha-galeria">
              {secundarias.map((f) => (
                <img key={f.storage_path} src={f.url} alt={f.alt ?? ""} loading="lazy" />
              ))}
            </div>
          ) : null}

          {/* La dirección va una sola vez y de lado a lado: es lo primero que
              se busca después del nombre, y antes salía repetida en la misma
              banda. */}
          <section className="ficha-banda">
            <div className="ficha-banda-donde">
              <span className="ficha-banda-pin">
                <IconoPin ancho={20} />
              </span>
              <div>
                <h2>Dirección</h2>
                <p>{direccion || "Este restaurante todavía no publica su dirección."}</p>
              </div>
            </div>
            {direccion ? (
              <a
                className="btn ficha-banda-boton"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${r.name} ${direccion}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconoCompartir ancho={19} />
                Cómo llegar
              </a>
            ) : null}
          </section>

          {/* El menú ya no se despliega entero aquí: se entra a él por el botón
              y, si la persona está frente a la mesa con el celular en la mano,
              por el QR. La ficha vuelve a caber en una pantalla. */}
          {hayMenu ? (
            <section className="ficha-menu-cta">
              <div className="ficha-menu-texto">
                <span className="ficha-menu-icono">
                  <IconoCubiertos ancho={26} />
                </span>
                <div>
                  <h2>Consulta nuestro menú completo</h2>
                  <p>
                    {r.summary
                      ? r.summary
                      : `Descubre los platillos y precios de ${r.name}.`}
                  </p>
                  <Link className="btn ficha-menu-boton" href={rutaMenu}>
                    Ver menú
                    <IconoFlecha ancho={19} />
                  </Link>
                </div>
              </div>

              <div className="ficha-menu-qr">
                <div className="ficha-menu-qr-caja">
                  <Qr texto={urlMenu} titulo={`Código QR del menú de ${r.name}`} />
                </div>
                <div>
                  <h3>Escanea el QR para ver el menú en tu celular</h3>
                  <p>Abre la cámara de tu celular y apunta al código.</p>
                </div>
              </div>
            </section>
          ) : (
            <section className="ficha-menu-cta ficha-menu-cta-vacia">
              <div className="ficha-menu-texto">
                <span className="ficha-menu-icono">
                  <IconoCubiertos ancho={26} />
                </span>
                <div>
                  <h2>Todavía no hay menú publicado</h2>
                  <p>Este restaurante aún no sube su carta. Vuelve pronto.</p>
                </div>
              </div>
            </section>
          )}

          {descripcion ? <p className="ficha-desc">{descripcion}</p> : null}

          {r.phone || r.website || redes.length || semana.length ? (
            <div className="ficha-detalles">
              {semana.length ? (
                <div className="ficha-card ficha-card-horarios" id="horarios">
                  <div className="ficha-card-cabeza">
                    <h3>
                      <IconoReloj ancho={19} />
                      Horarios
                    </h3>
                  </div>
                  <ul className="ficha-horarios">
                    {semana.map((d) => (
                      <li
                        key={d.dia}
                        className={[
                          d.dia === hoy ? "es-hoy" : "",
                          d.cerrado ? "es-cerrado" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="ficha-horarios-dia">
                          {DIAS[d.dia]}
                          {d.dia === hoy ? <em>Hoy</em> : null}
                        </span>
                        <span className="ficha-horarios-horas">
                          {d.cerrado
                            ? "Cerrado"
                            : d.tramos
                                .map((h) => `${hora(h.opens)} – ${hora(h.closes)}`)
                                .join(" y ")}
                          {d.dia === hoy && !d.cerrado ? (
                            <span
                              className={
                                abierto
                                  ? "ficha-estado ficha-estado-abierto"
                                  : "ficha-estado ficha-estado-cerrado"
                              }
                            >
                              {abierto ? "Abierto ahora" : "Cerrado ahora"}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {r.phone || r.website || redes.length ? (
                <div className="ficha-card ficha-card-contacto">
                  <div className="ficha-card-cabeza">
                    <h3>
                      <IconoTelefono ancho={19} />
                      Contacto y redes
                    </h3>
                  </div>

                  {redes.length ? (
                    <p className="ficha-card-intro">
                      Síguelos en sus redes sociales para ver novedades, promociones y más.
                    </p>
                  ) : null}

                  {r.phone || r.website ? (
                    <ul className="ficha-contacto">
                      {r.phone ? (
                        <li>
                          <a href={`tel:${r.phone}`}>
                            <IconoTelefono ancho={18} />
                            {r.phone}
                          </a>
                        </li>
                      ) : null}
                      {r.website ? (
                        <li>
                          <a href={r.website} target="_blank" rel="noopener noreferrer">
                            <IconoGlobo ancho={18} />
                            Sitio web
                          </a>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}

                  {/* Las redes van como fichas con su logo: una lista de
                      enlaces azules no dejaba ver de un vistazo cuáles hay. */}
                  {redes.length ? (
                    <ul className="ficha-redes">
                      {redes.map((red) => (
                        <li key={red.url}>
                          <a href={red.url} target="_blank" rel="noopener noreferrer">
                            <span className={`ficha-red-logo red-${red.slug}`}>
                              <IconoRed slug={red.slug} ancho={20} />
                            </span>
                            <span className="ficha-red-nombre">{red.nombre}</span>
                            <IconoEnlaceExterno ancho={16} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Las reseñas se salen del ancho del contenido y toman la ventana
            completa: son la segunda razón por la que se abre una ficha. */}
        <section className="resenas-banda" id="resenas">
          <div className="wrap">
            <header className="resenas-banda-encabezado">
              <h2>
                <IconoEstrella ancho={26} />
                Reseñas
              </h2>
              <p>Lo que dicen nuestros clientes</p>
            </header>

            <Resenas
              slug={slug}
              restaurante={r}
              resenas={resenas}
              usuarioId={usuario?.id ?? null}
              esDueno={esDueno}
            />
          </div>
        </section>

        <div className="wrap">
          <ul className="ficha-tira">
            <li>
              <IconoEscudo />
              <div>
                <strong>Información verificada</strong>
                <span>Datos actualizados por el restaurante</span>
              </div>
            </li>
            <li>
              <IconoReloj />
              <div>
                <strong>Horarios de atención</strong>
                <span>
                  {horarios.length ? "Consulta los horarios publicados" : "Pregunta al restaurante"}
                </span>
              </div>
            </li>
            <li>
              <IconoTarjeta />
              <div>
                <strong>Métodos de pago</strong>
                <span>Confirma con el restaurante</span>
              </div>
            </li>
            <li>
              <IconoTelefono />
              <div>
                <strong>¿Tienes dudas?</strong>
                <span>
                  {r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : "Contacta al restaurante"}
                </span>
              </div>
            </li>
          </ul>
        </div>
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
