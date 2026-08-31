import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import EditarForm from "./form";
import Fotos from "./fotos";
import Brand from "../../brand";
import { cambiarEstado } from "../actions";
import BorrarRestaurante from "../borrar";

export const metadata = { title: "Editar restaurante — Menú Abierto" };

const BUCKET_FOTOS = "restaurantes";

export default async function Editar({ params }) {
  const { id } = await params;
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select(
      "id, name, summary, description, city, neighborhood, street, state, postal_code, phone, website, price_level, status",
    )
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!restaurante) notFound();

  const [{ data: cuisines }, { data: elegidas }, { data: horarios }, { data: fotos }] =
    await Promise.all([
      supabase.from("cuisines").select("slug, name").order("name"),
      supabase
        .from("restaurant_cuisines")
        .select("cuisines (slug)")
        .eq("restaurant_id", id),
      supabase
        .from("restaurant_hours")
        .select("weekday, opens, closes")
        .eq("restaurant_id", id)
        .order("weekday"),
      supabase
        .from("restaurant_media")
        .select("id, storage_path, alt")
        .eq("restaurant_id", id)
        .order("position"),
    ]);

  const conUrl = (fotos ?? []).map((f) => ({
    ...f,
    url: supabase.storage.from(BUCKET_FOTOS).getPublicUrl(f.storage_path).data
      .publicUrl,
  }));

  const publicado = restaurante.status === "publicado";

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href="/panel">
          Volver
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <div className="panel-encabezado">
          <h1>{restaurante.name}</h1>
          <div className="panel-acciones">
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={restaurante.id} />
              <input
                type="hidden"
                name="status"
                value={publicado ? "oculto" : "publicado"}
              />
              <button className={publicado ? "btn-texto" : "btn"} type="submit">
                {publicado ? "Ocultar" : "Publicar"}
              </button>
            </form>
            <BorrarRestaurante id={restaurante.id} nombre={restaurante.name} />
          </div>
        </div>

        <p className="panel-lead">
          {publicado
            ? "Está publicado: cualquiera puede verlo."
            : "Está en borrador: solo tú lo ves hasta que lo publiques."}
        </p>

        <EditarForm
          restaurante={restaurante}
          cuisines={cuisines ?? []}
          elegidas={(elegidas ?? []).map((e) => e.cuisines?.slug).filter(Boolean)}
          horarios={horarios ?? []}
        />

        <Fotos id={restaurante.id} fotos={conUrl} />
      </main>
    </div>
  );
}
