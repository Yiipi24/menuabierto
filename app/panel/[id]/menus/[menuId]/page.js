import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../../lib/supabase";
import { rutaMenuCarta } from "../../../../../lib/slug";
import { urlAbsoluta } from "../../../../../lib/url";
import Brand from "../../../../brand";
import Qr from "../../../../_ficha/qr";
import QrDescarga from "../../../../_ficha/qr-descarga";
import Ajustes from "./ajustes";
import Archivo from "./archivo";
import Editor from "./editor";
import BorrarMenu from "./borrar";

export const metadata = { title: "Editar menú — Menú Abierto" };

const BUCKET_MENUS = "menus";

export default async function EditarMenu({ params }) {
  const { id, menuId } = await params;
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // Una sola consulta comprueba las dos cosas: que el menú existe y que el
  // restaurante es de quien está firmado.
  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, slug, status, highlights")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!restaurante) notFound();

  const { data: menu } = await supabase
    .from("menus")
    .select("id, name, description, kind, template, style, file_path, file_mime, is_visible")
    .eq("id", menuId)
    .eq("restaurant_id", id)
    .maybeSingle();

  if (!menu) notFound();

  const [{ data: secciones }, { data: platillos }] = await Promise.all([
    supabase
      .from("menu_sections")
      .select("id, name, position")
      .eq("menu_id", menuId)
      .order("position")
      .order("created_at"),
    supabase
      .from("menu_items")
      .select("id, section_id, name, description, price_cents, icon, is_available, position")
      .eq("menu_id", menuId)
      .order("position")
      .order("created_at"),
  ]);

  const urlArchivo = menu.file_path
    ? supabase.storage.from(BUCKET_MENUS).getPublicUrl(menu.file_path).data.publicUrl
    : null;

  // Cada carta tiene su propia dirección y, por lo tanto, su propio QR: el de
  // bebidas se pega en la barra y el de comida en la mesa, y cada uno abre solo
  // lo suyo. La marca de origen viaja en el enlace para que el escaneo se
  // cuente como tal en el tablero.
  const rutaCarta = rutaMenuCarta(restaurante.slug, menu.id);
  const urlCarta = await urlAbsoluta(`${rutaCarta}?src=qr`);
  // El QR apunta a una carta visible de una ficha publicada. Mientras falte
  // cualquiera de las dos cosas el código funciona, pero quien lo escanee se
  // topa con un 404: vale más avisarlo antes de mandarlo a la imprenta.
  const listoParaImprimir = menu.is_visible && restaurante.status === "publicado";

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href={`/panel/${id}/menus`}>
          Volver a los menús
        </Link>
      </header>

      <main className="wrap panel-main panel-taller">
        <div className="panel-encabezado">
          <h1>{menu.name}</h1>
          <BorrarMenu id={id} menuId={menu.id} nombre={menu.name} />
        </div>

        <p className="panel-lead">
          {menu.is_visible
            ? `Se ve en la ficha de ${restaurante.name}, si está publicada.`
            : "Está oculto: no aparece en la ficha hasta que lo muestres."}
        </p>

        {/* La vista previa de los ajustes pinta la carta de verdad, así que
            necesita lo mismo que la ficha: el restaurante, sus destacados y
            los platillos ya capturados. */}
        <Ajustes
          id={id}
          menu={menu}
          restaurante={restaurante}
          secciones={secciones ?? []}
          platillos={platillos ?? []}
        />

        <section className="panel-qr" id="qr">
          <QrDescarga nombreArchivo={`qr-${restaurante.slug.replace(/\//g, "-")}-${menu.id}`}>
            <div className="panel-qr-caja">
              <Qr texto={urlCarta} titulo={`Código QR de ${menu.name}`} />
            </div>
          </QrDescarga>

          <div className="panel-qr-texto">
            <h2>El QR de esta carta</h2>
            <p>
              Abre {menu.name} y nada más. Apunta siempre a {rutaCarta}, así que
              no hay que reimprimirlo cuando cambies platillos o precios.
            </p>
            {listoParaImprimir ? (
              <p>
                <a href={rutaCarta} target="_blank" rel="noopener noreferrer">
                  Ver la carta como la ve quien lo escanea
                </a>
              </p>
            ) : (
              <p className="panel-qr-aviso">
                {menu.is_visible
                  ? "Tu ficha todavía no está publicada, así que este QR da 404. Publícala antes de imprimirlo."
                  : "Este menú está oculto, así que el QR da 404. Muéstralo antes de imprimirlo."}
              </p>
            )}
          </div>
        </section>

        {menu.kind === "archivo" ? (
          <Archivo id={id} menu={menu} url={urlArchivo} />
        ) : (
          <Editor
            id={id}
            menuId={menu.id}
            secciones={secciones ?? []}
            platillos={platillos ?? []}
          />
        )}
      </main>
    </div>
  );
}
