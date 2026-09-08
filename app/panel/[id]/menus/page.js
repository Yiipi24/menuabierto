import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../lib/supabase";
import { menusIncluidos, nombreDelPlan } from "../../../../lib/planes";
import { nombreDePlantilla } from "../../../../lib/plantillas";
import { rutaMenuCarta } from "../../../../lib/slug";
import { textoDeHorario, seSirveAhora } from "../../../../lib/horarios-menu";
import CabeceraPanel from "../../cabecera";
import {
  IconoCarta,
  IconoDocumento,
  IconoEstrella,
  IconoFoco,
  IconoMas,
  IconoQr,
  IconoOjo,
} from "../../tablero-iconos";
import NuevoMenu from "./nuevo";
import AccionesDeMenu from "./acciones";

export const metadata = { title: "Menús — Menú Abierto" };

const BUCKET_MENUS = "menus";

const CONSEJOS = [
  "Usa fotos de buena calidad.",
  "Nombres claros y atractivos.",
  "Incluye descripciones cortas.",
  "Mantén los precios actualizados.",
  "Organiza los platillos en secciones (Entradas, Tacos, Postres…).",
];

// "6 sep 2026, 14:32". La fecha se arma en la zona del local y no en la del
// servidor: en Vercel ya es de madrugada del día siguiente mientras en el
// restaurante todavía es la tarde en que se guardó el cambio.
function actualizado(valor, zona) {
  if (!valor) return null;
  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: zona || "America/Mexico_City",
    }).format(new Date(valor));
  } catch {
    return null;
  }
}

export default async function Menus({ params }) {
  const { id } = await params;
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, slug, status, plan, premium_until, timezone")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!restaurante) notFound();

  // Las cuentas de secciones y platillos se traen crudas y se agrupan aquí:
  // PostgREST no hace GROUP BY, y son pocas filas por restaurante.
  //
  // Las sucursales llenan el "duplicar a…" de cada fila. Van por RPC porque
  // `restaurants` solo deja leer las publicadas o las propias, y aquí hacen
  // falta las propias aunque estén en borrador.
  const [{ data: menus }, { data: secciones }, { data: platillos }, { data: sucursales }] =
    await Promise.all([
      supabase
        .from("menus")
        .select(
          "id, name, kind, template, file_path, file_mime, is_visible, is_primary, service_time, serves_from, serves_to, position, updated_at",
        )
        .eq("restaurant_id", id)
        .order("position")
        .order("created_at"),
      supabase.from("menu_sections").select("id, menu_id").eq("restaurant_id", id),
      supabase.from("menu_items").select("id, menu_id").eq("restaurant_id", id),
      supabase.rpc("mis_sucursales", { rid: id }),
    ]);

  const cuenta = (filas, menuId) =>
    (filas ?? []).filter((f) => f.menu_id === menuId).length;

  const lista = menus ?? [];
  const cupo = menusIncluidos(restaurante);
  const quedan = Math.max(0, cupo - lista.length);
  const lleno = quedan === 0;
  // La barra nunca pasa del 100% aunque un plan que venció deje más menús de
  // los que ahora caben.
  const avance = Math.min(100, Math.round((lista.length / Math.max(cupo, 1)) * 100));
  const publicado = restaurante.status === "publicado";

  return (
    <div className="panel-wrap">
      <CabeceraPanel
        correo={auth.user.email}
        usuarioId={auth.user.id}
        marca="/panel"
        atras={`/panel/${id}`}
        atrasTexto="Volver a la ficha"
      />

      <main className="wrap panel-main panel-taller">
        <div className="panel-encabezado">
          <div>
            <h1>Menús</h1>
            <p className="panel-lead panel-lead-pegado">
              Crea y administra los menús de {restaurante.name}. Cada menú puede
              tener secciones, platillos, precios e imágenes. Se abren desde el
              código QR, desde tu ficha, y tus clientes también pueden
              descargarlos en PDF.
            </p>
          </div>

          {lleno ? (
            <Link className="btn" href="/panel/planes">
              Ver planes
            </Link>
          ) : (
            <a className="btn btn-con-icono" href="#crear-menu">
              <IconoMas ancho={18} />
              Agregar un menú
            </a>
          )}
        </div>

        <section className="tarjeta-lista">
          <header className="tarjeta-lista-top">
            <h2>
              Tus menús <span className="cupo">({lista.length} de {cupo})</span>
            </h2>
            <div className="cupo-barra-caja">
              <span className="cupo-texto">
                {lista.length} de {cupo} menús creados
              </span>
              <span className="cupo-barra" role="presentation">
                <span
                  className={`cupo-barra-llena${lleno ? " cupo-lleno" : ""}`}
                  style={{ width: `${avance}%` }}
                />
              </span>
            </div>
          </header>

          {lista.length ? (
            <ul className="lista-menus">
              {lista.map((m) => {
                const esArchivo = m.kind === "archivo";
                const horario = textoDeHorario(m);
                const sirviendo = seSirveAhora(m, restaurante.timezone);
                const fecha = actualizado(m.updated_at, restaurante.timezone);
                const carta = rutaMenuCarta(restaurante.slug, m.id);
                // Un menú de archivo ya es un PDF o una imagen: su botón lleva
                // al archivo tal cual. Uno capturado se imprime desde su
                // propia página, con la plantilla que eligió el dueño.
                const archivoUrl = m.file_path
                  ? supabase.storage.from(BUCKET_MENUS).getPublicUrl(m.file_path).data.publicUrl
                  : null;
                const pdf = esArchivo ? archivoUrl : `${carta}?pdf=1`;

                return (
                  <li className="fila-menu" key={m.id}>
                    <div className="fila-menu-datos">
                      <div className="fila-menu-titulo">
                        <Link className="fila-menu-nombre" href={`/panel/${id}/menus/${m.id}`}>
                          {m.name}
                        </Link>
                        <span className={m.is_visible ? "estado estado-publicado" : "estado"}>
                          {m.is_visible ? "Visible" : "Oculto"}
                        </span>
                        {m.is_primary ? (
                          <span className="insignia insignia-principal">
                            <IconoEstrella ancho={14} />
                            Menú principal
                          </span>
                        ) : null}
                        {horario ? (
                          <span
                            className={`insignia${sirviendo ? " insignia-ahora" : ""}`}
                            title={sirviendo ? "Se está sirviendo ahora" : undefined}
                          >
                            {horario}
                            {sirviendo ? " · ahora" : ""}
                          </span>
                        ) : null}
                      </div>

                      <p className="fila-meta">
                        {esArchivo
                          ? archivoUrl
                            ? "Archivo subido"
                            : "Archivo · falta subirlo"
                          : `${cuenta(secciones, m.id)} ${
                              cuenta(secciones, m.id) === 1 ? "sección" : "secciones"
                            } · ${cuenta(platillos, m.id)} ${
                              cuenta(platillos, m.id) === 1 ? "platillo" : "platillos"
                            } · Plantilla: ${nombreDePlantilla(m.template)}`}
                      </p>
                      {fecha ? (
                        <p className="fila-meta fila-meta-suave">Última actualización: {fecha}</p>
                      ) : null}
                    </div>

                    <div className="fila-botones">
                      {/* Ver, QR y PDF llevan a la carta pública. Sin publicar
                          la ficha no hay nada que abrir, así que se quedan
                          apagados en vez de mandar a un 404. */}
                      {publicado && m.is_visible ? (
                        <>
                          <Link className="btn-fila" href={carta} target="_blank">
                            <IconoOjo ancho={16} />
                            Ver
                          </Link>
                          <Link className="btn-fila" href={`/panel/${id}/qr`}>
                            <IconoQr ancho={16} />
                            QR
                          </Link>
                        </>
                      ) : (
                        <span className="btn-fila btn-fila-off" title="Publica la ficha y muestra el menú para poder abrirlo">
                          <IconoOjo ancho={16} />
                          Ver
                        </span>
                      )}

                      {pdf ? (
                        <a className="btn-fila" href={pdf} target="_blank" rel="noreferrer">
                          <IconoDocumento ancho={16} />
                          PDF
                        </a>
                      ) : null}

                      <AccionesDeMenu id={id} menu={m} sucursales={sucursales ?? []} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="vacio">
              <h2>Todavía no tienes ningún menú</h2>
              <p>
                Empieza por la carta principal. Le agregas secciones —entradas,
                platos fuertes, bebidas— y dentro de cada una sus platillos con
                precio.
              </p>
              <a className="btn" href="#crear-menu">
                Crear el primero
              </a>
            </div>
          )}
        </section>

        <div className="menus-columnas">
          <div className="menus-columna-ancha">
            <NuevoMenu id={id} quedan={quedan} cupo={cupo} />

            {lleno ? (
              <p className="plan-note">
                Llegaste a los {cupo} menús de tu plan {nombreDelPlan(restaurante)}. Con un
                plan más grande caben más. <Link href="/panel/planes">Ver los planes</Link>.
              </p>
            ) : null}
          </div>

          <aside className="menus-columna-lado">
            <section className="tarjeta-lado">
              <h2>
                <IconoFoco ancho={18} />
                Consejos para un mejor menú
              </h2>
              <ul className="lista-palomitas">
                {CONSEJOS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>

            <section className="tarjeta-lado">
              <h2>
                <IconoQr ancho={18} />
                ¿Cómo lo ven tus clientes?
              </h2>
              <ul className="lista-iconos">
                <li>
                  <IconoQr ancho={17} />
                  Desde el código QR de tu restaurante
                </li>
                <li>
                  <IconoCarta ancho={17} />
                  En la ficha de tu restaurante en Menú Abierto
                </li>
                <li>
                  <IconoDocumento ancho={17} />
                  Pueden descargarlo en PDF
                </li>
              </ul>
              <Link className="btn-texto" href={`/panel/${id}/qr`}>
                Ver el QR de tu restaurante →
              </Link>
            </section>

            <section className="tarjeta-lado tarjeta-lado-plan">
              <p>
                Tu plan {nombreDelPlan(restaurante)} incluye hasta {cupo} menús.
                {lleno ? " Ya los tienes todos." : ` Puedes crear ${quedan} más.`}
              </p>
              <Link className="btn-texto" href="/panel/planes">
                Ver planes →
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
