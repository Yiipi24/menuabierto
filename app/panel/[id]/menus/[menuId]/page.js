import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../../lib/supabase";
import Brand from "../../../../brand";
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
    .select("id, name")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!restaurante) notFound();

  const { data: menu } = await supabase
    .from("menus")
    .select("id, name, kind, template, file_path, file_mime, is_visible")
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
      .select("id, section_id, name, description, price_cents, is_available, position")
      .eq("menu_id", menuId)
      .order("position")
      .order("created_at"),
  ]);

  const urlArchivo = menu.file_path
    ? supabase.storage.from(BUCKET_MENUS).getPublicUrl(menu.file_path).data.publicUrl
    : null;

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href={`/panel/${id}/menus`}>
          Volver a los menús
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <div className="panel-encabezado">
          <h1>{menu.name}</h1>
          <BorrarMenu id={id} menuId={menu.id} nombre={menu.name} />
        </div>

        <p className="panel-lead">
          {menu.is_visible
            ? `Se ve en la ficha de ${restaurante.name}, si está publicada.`
            : "Está oculto: no aparece en la ficha hasta que lo muestres."}
        </p>

        <Ajustes id={id} menu={menu} />

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
