import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../../lib/supabase";
import { rutaMenuCarta } from "../../../../../lib/slug";
import { catalogoDeEtiquetas, conEtiquetas } from "../../../../../lib/etiquetas-platillo";
import CabeceraPanel from "../../../cabecera";
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

  const [{ data: secciones }, { data: platillos }, { data: etiquetas }] = await Promise.all([
    supabase
      .from("menu_sections")
      .select("id, name, position")
      .eq("menu_id", menuId)
      .order("position")
      .order("created_at"),
    supabase
      .from("menu_items")
      .select("id, section_id, name, description, price_cents, icon, labels, is_available, position")
      .eq("menu_id", menuId)
      .order("position")
      .order("created_at"),
    // El catálogo de etiquetas vive en la base para que agregar una no exija
    // desplegar. Va en el mismo Promise.all: es una consulta diminuta.
    supabase.from("dish_labels").select("slug, name, hint, icon, kind").order("position"),
  ]);

  // Se resuelven aquí, del lado del servidor, y ya resueltas viajan al editor y
  // a la vista previa: los dos pintan lo mismo que la ficha y ninguno tiene que
  // cruzar el catálogo mientras dibuja.
  const catalogoEtiquetas = catalogoDeEtiquetas(etiquetas ?? []);
  const platillosConEtiquetas = conEtiquetas(catalogoEtiquetas, platillos ?? []);

  const urlArchivo = menu.file_path
    ? supabase.storage.from(BUCKET_MENUS).getPublicUrl(menu.file_path).data.publicUrl
    : null;

  // La carta tiene su propia dirección y se puede compartir tal cual, pero ya
  // no tiene su propio QR: el código impreso es uno solo por restaurante y
  // abre la ficha, que es de donde el comensal elige la carta que quiere.
  const rutaCarta = rutaMenuCarta(restaurante.slug, menu.id);
  const visibleParaTodos = menu.is_visible && restaurante.status === "publicado";

  return (
    <div className="panel-wrap">
      <CabeceraPanel correo={auth.user.email} usuarioId={auth.user.id} marca="/panel" atras={`/panel/${id}/menus`} atrasTexto="Volver a los menús" />

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
          platillos={platillosConEtiquetas}
        />

        <section className="panel-enlace-carta">
          <div>
            <h2>La dirección de esta carta</h2>
            <p>
              {visibleParaTodos ? (
                <a href={rutaCarta} target="_blank" rel="noopener noreferrer">
                  {rutaCarta}
                </a>
              ) : (
                rutaCarta
              )}
            </p>
            <p className="panel-enlace-nota">
              {visibleParaTodos
                ? "Sirve para compartirla suelta, por WhatsApp o en tus redes."
                : menu.is_visible
                  ? "Tu ficha todavía no está publicada, así que esta dirección da 404 para quien no seas tú."
                  : "Este menú está oculto, así que su dirección da 404 hasta que lo muestres."}
            </p>
          </div>
          <Link className="btn-linea" href={`/panel/${id}/qr`}>
            El QR del restaurante
          </Link>
        </section>

        {menu.kind === "archivo" ? (
          <Archivo id={id} menu={menu} url={urlArchivo} />
        ) : (
          <Editor
            id={id}
            menuId={menu.id}
            secciones={secciones ?? []}
            platillos={platillosConEtiquetas}
            catalogoEtiquetas={catalogoEtiquetas}
          />
        )}
      </main>
    </div>
  );
}
