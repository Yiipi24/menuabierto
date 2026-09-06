import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../lib/supabase";
import { rutaFicha, rutaQr } from "../../../../lib/slug";
import { urlAbsoluta } from "../../../../lib/url";
import Brand from "../../../brand";
import Qr from "../../../_ficha/qr";
import QrDescarga from "../../../_ficha/qr-descarga";
import CopiarEnlace from "./copiar";

export const metadata = { title: "El QR de tu restaurante — Menú Abierto" };

// La pantalla del QR del restaurante. Es uno solo y es el mismo siempre: el
// que se pega en la mesa, en la entrada y en la cuenta, y el que abre la
// página del restaurante con todas sus cartas.
//
// Antes había uno por carta y esta pantalla no existía: el dueño tenía que
// entrar a cada menú para bajar su código, y cada carta nueva era un vinil
// nuevo. Ahora se imprime una vez y ya.
export default async function QrDelRestaurante({ params }) {
  const { id } = await params;
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, slug, status, qr_code")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!restaurante) notFound();

  const { count: menus } = await supabase
    .from("menus")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", id)
    .eq("is_visible", true);

  const ruta = rutaQr(restaurante.qr_code);
  const url = await urlAbsoluta(ruta);
  const publicado = restaurante.status === "publicado";
  const sinMenu = !menus;

  // El nombre del archivo es lo que el dueño va a ver en su carpeta de
  // descargas y lo que le va a mandar a la imprenta, así que lleva el nombre
  // del restaurante y no el código.
  const archivo = `qr-${restaurante.slug.replace(/\//g, "-")}`;

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href={`/panel/${id}`}>
          Volver
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <div className="panel-encabezado">
          <h1>El QR de {restaurante.name}</h1>
        </div>

        <p className="panel-lead">
          Es uno solo y no cambia nunca. Quien lo escanea abre tu página en su
          celular: tus menús, tus horarios y cómo llegar.
        </p>

        {/* El código primero y grande: es a lo que se entra a esta pantalla.
            Todo lo demás —el enlace, los consejos— va debajo. */}
        <section className="qr-hoja">
          <QrDescarga nombreArchivo={archivo}>
            <div className="qr-hoja-caja">
              <Qr texto={url} titulo={`Código QR de ${restaurante.name}`} />
            </div>
          </QrDescarga>
        </section>

        <section className="panel-tarjeta qr-bloque">
          <h2>Su dirección</h2>
          <p className="qr-parrafo">
            El código lleva aquí, y esta dirección es tuya para siempre: no
            cambia aunque cambies el nombre, los menús o los precios. Por eso lo
            imprimes una sola vez.
          </p>
          <CopiarEnlace url={url} />
          <p className="qr-parrafo">
            <a href={ruta} target="_blank" rel="noopener noreferrer">
              Ábrelo como lo ve quien lo escanea
            </a>
          </p>
        </section>

        {!publicado || sinMenu ? (
          <section className="panel-tarjeta qr-bloque qr-aviso">
            <h2>Antes de mandarlo a imprimir</h2>
            <ul>
              {publicado ? null : (
                <li>
                  Tu ficha está en borrador: hoy el código da 404 para quien no
                  seas tú. <Link href={`/panel/${id}`}>Publícala</Link> antes de
                  pegar el vinil.
                </li>
              )}
              {sinMenu ? (
                <li>
                  No tienes ningún menú visible, así que quien escanee llega a
                  una página sin carta.{" "}
                  <Link href={`/panel/${id}/menus`}>Agrega uno</Link>.
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        <section className="panel-tarjeta qr-bloque">
          <h2>Cómo imprimirlo</h2>
          <ul className="qr-consejos">
            <li>
              <strong>Para la imprenta, el SVG.</strong> No pierde nitidez por
              grande que lo pongas: sirve igual para una calcomanía de mesa que
              para una lona.
            </li>
            <li>
              <strong>Para Canva, Word o WhatsApp, el PNG.</strong> Sale de
              1600 píxeles, suficiente para un letrero.
            </li>
            <li>
              <strong>Cinco centímetros de lado, mínimo.</strong> Es lo que un
              celular alcanza a leer desde el otro lado de la mesa.
            </li>
            <li>
              <strong>Deja el marco blanco.</strong> El borde en blanco que
              trae el archivo no es adorno: sin él, muchas cámaras no
              encuentran el código.
            </li>
          </ul>
        </section>

        <section className="panel-tarjeta qr-bloque">
          <h2>Y también sin QR</h2>
          <p className="qr-parrafo">
            Quien no quiera escanear puede escribir tu dirección de siempre:{" "}
            <Link href={rutaFicha(restaurante.slug)}>
              {rutaFicha(restaurante.slug)}
            </Link>
            . Es la misma página.
          </p>
        </section>
      </main>
    </div>
  );
}
