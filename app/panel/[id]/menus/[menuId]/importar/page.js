import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../../../lib/supabase";
import { uuidValido } from "../../../../../../lib/slug";
import { resumenDeExtraccion } from "../../../../../../lib/extraccion";
import { visionConfigurada } from "../../../../../../lib/vision";
import CabeceraPanel from "../../../../cabecera";
import Subir from "./subir";
import Revision from "./revision";
import { cupoDeLecturas } from "./cupo";

export const metadata = { title: "Cargar la carta desde una foto — Menú Abierto" };

// Leer una foto tarda: el modelo mira la imagen entera y escribe cuarenta
// platillos. Sin esto Vercel corta la acción a los quince segundos y el dueño
// ve un error cuando la lectura iba a la mitad.
export const maxDuration = 120;

export default async function Importar({ params, searchParams }) {
  const { id, menuId } = await params;
  const { revisar } = await searchParams;

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, plan, premium_until")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!restaurante) notFound();

  const { data: menu } = await supabase
    .from("menus")
    .select("id, name, kind, file_path, file_mime")
    .eq("id", menuId)
    .eq("restaurant_id", id)
    .maybeSingle();
  if (!menu) notFound();

  const volver = `/panel/${id}/menus/${menuId}`;

  // Con `?revisar=<id>` la página es la de revisión: lo que el modelo leyó,
  // editable, y el botón que lo pasa al menú. Sin ella, la de subir la foto.
  let extraccion = null;
  if (typeof revisar === "string" && uuidValido(revisar)) {
    const { data } = await supabase
      .from("menu_extractions")
      .select("id, status, result, created_at")
      .eq("id", revisar)
      .eq("restaurant_id", id)
      .maybeSingle();
    if (data?.status === "ok" && data.result?.legible) extraccion = data;
  }

  const cupo = await cupoDeLecturas(supabase, restaurante);

  return (
    <div className="panel-wrap">
      <CabeceraPanel
        correo={auth.user.email}
        usuarioId={auth.user.id}
        marca="/panel"
        atras={volver}
        atrasTexto={`Volver a ${menu.name}`}
      />

      <main className="wrap panel-main panel-taller">
        <h1>Cargar la carta desde una foto</h1>

        {extraccion ? (
          <>
            <p className="panel-lead">
              Esto es lo que leímos. Revísalo antes de guardarlo: corrige lo que
              esté mal, desmarca lo que sobre y agrega lo que falte. Nada entra
              al menú hasta que lo confirmes.
            </p>
            <Revision
              id={id}
              menuId={menuId}
              extraccionId={extraccion.id}
              extraccion={extraccion.result}
              resumen={resumenDeExtraccion(extraccion.result)}
              volver={volver}
            />
          </>
        ) : (
          <>
            <p className="panel-lead">
              Toma una foto de tu carta —o sube el PDF— y la convertimos en
              secciones, platillos y precios que puedes corregir. Es más rápido
              que capturar sesenta platillos a mano, y no publica nada sin que
              lo revises.
            </p>
            <Subir
              id={id}
              menu={menu}
              cupo={cupo}
              habilitado={visionConfigurada()}
              volver={volver}
            />
          </>
        )}

        <p className="ayuda">
          <Link href={volver}>Volver al editor de {menu.name}</Link>
        </p>
      </main>
    </div>
  );
}
