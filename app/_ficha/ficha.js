import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import { rutaFicha, rutaMenuCarta } from "../../lib/slug";
import { descripcionDeMenu } from "../../lib/menus";
import { imagenesDeCompartir, metaCompartir } from "../../lib/compartir";
import { jsonLdFicha } from "../../lib/jsonld";
import { enlaceWhatsapp, mensajeDeContacto, telefonoLegible } from "../../lib/whatsapp";
import { urlDelSitio } from "../../lib/sitio";
import { BotonPedirWhatsapp } from "./pedido";
import DatosEstructurados from "./datos-estructurados";
import Nav from "../nav";
import Resenas from "./resenas";
import Seguir from "../_social/seguir";
import Historias from "../_social/historias";
import Publicaciones from "../_social/publicaciones";
import { cargarSocial, recogerHistoriasViejas } from "../_social/datos";
import ComoLlegar from "./como-llegar";
import Cupones from "./cupones";
import MenusAcordeon from "./menus-acordeon";
import { IconoDeMenu } from "./iconos-menu";
import { ordenarParaLaFicha, seSirveAhora, textoDeHorario } from "../../lib/horarios-menu";
import { MedirVista, EnlaceMedido, BotonGuardar } from "../medir";
import {
  cargar,
  cargarPublico,
  diaLocal,
  direccionDe,
  hora,
  repiteDireccion,
  resenasEscritas,
  DIAS,
  PRECIO,
} from "./datos";
import { IconoDestacado } from "../destacados";
import { IconoRed } from "../redes-iconos";
import { IconoPago } from "../pagos-iconos";
import { IconoServicio } from "../servicios-iconos";
import {
  IconoChevron,
  IconoCubiertos,
  IconoEscudo,
  IconoEstrella,
  IconoFlechaAtras,
  IconoEnlaceExterno,
  IconoGlobo,
  IconoPin,
  IconoReloj,
  IconoTarjeta,
  IconoTelefono,
} from "./iconos";

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

  // Cada carta llega a la lista con lo suyo: su icono, su línea y su página.
  // Ya no lleva QR: el código impreso es uno solo por restaurante y abre esta
  // misma ficha, así que enseñar cuatro códigos aquí sería ofrecer cuatro
  // vinilos que nadie va a pegar.
  // El orden no es el que puso el dueño a secas: primero la carta principal,
  // luego las que se están sirviendo a esta hora y al final las que no. Quien
  // abre la ficha a las nueve de la noche viene por la cena, y tener el menú
  // de desayuno hasta arriba lo obliga a leer tres cartas para descartar dos.
  const cartas = ordenarParaLaFicha(menus, r.timezone).map((m) => ({
    id: m.id,
    nombre: m.name,
    descripcion: descripcionDeMenu(m),
    horario: textoDeHorario(m),
    // `null` cuando la carta se sirve a cualquier hora: ahí no hay nada que
    // marcar, ni a favor ni en contra.
    sirviendo: seSirveAhora(m, r.timezone),
    principal: Boolean(m.isPrimary),
    href: rutaMenuCarta(slug, m.id),
    icono: <IconoDeMenu nombre={m.name} ancho={24} />,
  }));

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
      <Nav />

      <main className="ficha">
        <DatosEstructurados datos={jsonLdFicha(datos, slug)} />
        <MedirVista slug={slug} />
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
              {/* La calificación y el botón que baja a las reseñas van en su
                  propio renglón, arriba de los seguidores: son dos preguntas
                  distintas —"¿está bueno?" y "¿lo sigo?"— y mezcladas en una
                  sola fila ninguna de las dos se leía. El scroll suave hasta
                  #resenas lo hace el `scroll-behavior` del documento, así que
                  esto sigue siendo un ancla y funciona sin JavaScript. */}
              <p className="ficha-meta ficha-meta-calificacion">
                {r.rating_count > 0 && r.rating_avg ? (
                  <>
                    <a className="ficha-resenas-enlace" href="#resenas">
                      <IconoEstrella ancho={17} />
                      <strong>{r.rating_avg}</strong> · {r.rating_count}{" "}
                      {r.rating_count === 1 ? "reseña" : "reseñas"}
                    </a>
                    <a className="ficha-ver-resenas" href="#resenas">
                      Ver reseñas
                      <IconoChevron ancho={16} />
                    </a>
                  </>
                ) : (
                  <a className="ficha-sinresenas" href="#resenas">
                    Aún sin reseñas · escribe la primera
                  </a>
                )}
              </p>

              <p className="ficha-meta ficha-meta-social">
                <Seguir
                  restauranteId={r.id}
                  nombre={r.name}
                  seguidores={r.followers_count ?? 0}
                  sigo={social.sigo}
                  alerta={social.alerta}
                  volverA={volverAqui}
                />
              </p>

              <p className="ficha-meta">
                {abierto ? (
                  <span className="ficha-abierto">Abierto ahora</span>
                ) : horarios.length ? (
                  <span className="ficha-cerrado">Cerrado ahora</span>
                ) : null}
                <BotonGuardar slug={slug} nombre={r.name} />
              </p>

              {/* Pedir va arriba, junto al estado del local: quien decide
                  pedir ya decidió al leer "Abierto ahora", y mandarlo a
                  buscar el botón al final de la ficha es perder la venta que
                  el restaurante vino a hacer aquí. La carta tiene el suyo,
                  con los platillos elegidos dentro del mensaje. */}
              {pedidos ? (
                <p className="ficha-pedir">
                  <BotonPedirWhatsapp
                    telefono={pedidos.telefono}
                    mensaje={mensajeDeContacto(r.name, urlDelSitio(volverAqui))}
                    slug={slug}
                  />
                  {pedidos.nota ? (
                    <span className="ficha-pedir-nota">{pedidos.nota}</span>
                  ) : null}
                </p>
              ) : null}

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

          {/* Las historias van entre la galería y la dirección: son el "qué hay
              hoy" y se miran de pasada, antes de decidir si vale la pena leer
              la dirección. Si no hay ninguna, el componente no pinta nada y la
              ficha queda como estaba. */}
          <Historias historias={social.historias} nombre={r.name} volverA={volverAqui} />

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
              <ComoLlegar slug={slug} nombre={r.name} direccion={direccion} />
            ) : null}
          </section>

          {/* Los cupones van antes de los menús: son lo que caduca, y quien
              baja directo a la carta ya no vuelve a subir. */}
          <Cupones slug={slug} cupones={cupones} />

          {/* Las cartas no se despliegan aquí: cada una se abre en su página, y
              quien está sentado en la mesa entra por su QR. La ficha vuelve a
              caber en una pantalla aunque el restaurante tenga cuatro. */}
          {hayMenu ? (
            <section className="ficha-menu-cta">
              <MenusAcordeon
                cartas={cartas}
                titulo={menus.length > 1 ? "Consulta nuestros menús" : "Consulta nuestro menú"}
                pista={
                  r.summary ? r.summary : "Ábrelo aquí mismo: precios al día, sin descargar nada."
                }
                icono={<IconoCubiertos ancho={26} />}
                nota={
                  /* El QR no se pinta en la ficha pública: quien la está
                     viendo ya llegó, y el que tiene que imprimirlo es el
                     dueño. Vive en su panel, donde puede bajarlo en PNG y en
                     SVG. */
                  esDueno ? (
                    <p className="ficha-menu-nota">
                      Tu restaurante tiene un solo código QR y esta es la página que abre.
                      No cambia nunca, así que se imprime una vez y sigue sirviendo aunque
                      cambies de menús o de precios. Lo descargas en{" "}
                      <Link href={`/panel/${r.id}/qr`}>tu QR</Link>.
                    </p>
                  ) : null
                }
              />
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

          {/* Las novedades van justo después del menú: quien ya sabe qué se
              come aquí es el que quiere ver lo de esta semana. Si el
              restaurante todavía no publica nada, la sección no existe en vez
              de salir vacía. */}
          {social.publicaciones.length ? (
            <section className="novedades" id="novedades">
              <h2 className="novedades-titulo">Novedades de {r.name}</h2>
              <Publicaciones
                publicaciones={social.publicaciones}
                restauranteId={r.id}
                nombre={r.name}
                slug={slug}
                volverA={volverAqui}
                hayMas={social.hayMasPublicaciones}
              />
            </section>
          ) : null}

          {descripcion ? <p className="ficha-desc">{descripcion}</p> : null}

          {r.phone ||
          r.website ||
          redes.length ||
          pedidos ||
          semana.length ||
          pagos.length ||
          servicios.length ? (
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

              {r.phone || r.website || pedidos || redes.length ? (
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

                  {r.phone || r.website || pedidos ? (
                    <ul className="ficha-contacto">
                      {/* El WhatsApp encabeza la lista y va con su número a la
                          vista: es el que se toca, y el que alguien copia para
                          guardarlo en su agenda. Puede no ser el mismo
                          teléfono de arriba —casi nunca lo es— así que se
                          enseñan los dos. */}
                      {pedidos ? (
                        <li>
                          <EnlaceMedido
                            slug={slug}
                            evento="whatsapp_click"
                            href={enlaceWhatsapp(
                              pedidos.telefono,
                              mensajeDeContacto(r.name, urlDelSitio(volverAqui)),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="ficha-red-logo red-whatsapp">
                              <IconoRed slug="whatsapp" ancho={18} />
                            </span>
                            Pedidos por WhatsApp · {telefonoLegible(pedidos.telefono)}
                          </EnlaceMedido>
                        </li>
                      ) : null}
                      {r.phone ? (
                        <li>
                          <EnlaceMedido
                            slug={slug}
                            evento="phone_click"
                            href={`tel:${r.phone}`}
                          >
                            <IconoTelefono ancho={18} />
                            {r.phone}
                          </EnlaceMedido>
                        </li>
                      ) : null}
                      {r.website ? (
                        <li>
                          <EnlaceMedido
                            slug={slug}
                            evento="website_click"
                            href={r.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconoGlobo ancho={18} />
                            Sitio web
                          </EnlaceMedido>
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
                          <EnlaceMedido
                            slug={slug}
                            evento="social_click"
                            href={red.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className={`ficha-red-logo red-${red.slug}`}>
                              <IconoRed slug={red.slug} ancho={20} />
                            </span>
                            <span className="ficha-red-nombre">{red.nombre}</span>
                            <IconoEnlaceExterno ancho={16} />
                          </EnlaceMedido>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* Las formas de pago van en su propia tarjeta y no en un
                  renglón de texto: quien pregunta "¿aceptan tarjeta?" busca un
                  sí o un no, no un párrafo que hay que leer entero. */}
              {pagos.length ? (
                <div className="ficha-card ficha-card-pagos" id="pagos">
                  <div className="ficha-card-cabeza">
                    <h3>
                      <IconoTarjeta ancho={19} />
                      Formas de pago
                    </h3>
                  </div>
                  <ul className="ficha-pagos">
                    {pagos.map((forma) => (
                      <li key={forma.slug}>
                        <span className="ficha-pago-icono">
                          <IconoPago slug={forma.icono} ancho={20} />
                        </span>
                        <span className="ficha-pago-texto">
                          <strong>{forma.nombre}</strong>
                          <span>{forma.pista}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Los servicios son la otra mitad de "¿qué me encuentro al
                  llegar?", y se preguntan antes de salir de casa igual que la
                  forma de pago. */}
              {servicios.length ? (
                <div className="ficha-card ficha-card-servicios" id="servicios">
                  <div className="ficha-card-cabeza">
                    <h3>
                      {/* El dibujo del primero de la lista y no uno fijo: una
                          tarjeta que solo trae wifi encabezada por la P del
                          estacionamiento se lee como un error. */}
                      <IconoServicio slug={servicios[0].icono} ancho={19} />
                      Servicios
                    </h3>
                  </div>
                  <ul className="ficha-pagos">
                    {servicios.map((servicio) => (
                      <li key={servicio.slug}>
                        <span className="ficha-pago-icono">
                          <IconoServicio slug={servicio.icono} ancho={20} />
                        </span>
                        <span className="ficha-pago-texto">
                          <strong>{servicio.nombre}</strong>
                          <span>{servicio.pista}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
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
              misResenas={misResenas}
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
                <span>
                  {/* Solo las dos primeras: el renglón vive en una tira de
                      cuatro columnas y las cinco formas seguidas lo convertían
                      en un párrafo subrayado de cuatro líneas. El resto está a
                      un clic, en la tarjeta de arriba. */}
                  {pagos.length ? (
                    <a href="#pagos">
                      {pagos.slice(0, 2).map((f) => f.nombre).join(" · ")}
                      {pagos.length > 2 ? ` y ${pagos.length - 2} más` : ""}
                    </a>
                  ) : (
                    "Confirma con el restaurante"
                  )}
                </span>
              </div>
            </li>
            <li>
              <IconoTelefono />
              <div>
                <strong>¿Tienes dudas?</strong>
                <span>
                  {r.phone ? (
                    <EnlaceMedido slug={slug} evento="phone_click" href={`tel:${r.phone}`}>
                      {r.phone}
                    </EnlaceMedido>
                  ) : (
                    "Contacta al restaurante"
                  )}
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
