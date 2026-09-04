import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { menusIncluidos, fotosPlatillosIncluidas } from "../../../lib/planes";
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
      "id, name, summary, description, city, neighborhood, street, state, postal_code, phone, website, price_level, status, plan, premium_until, highlights, social_links, payment_methods, closed_days",
    )
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!restaurante) notFound();

  const [
    { data: cuisines },
    { data: elegidas },
    { data: horarios },
    { data: fotos },
    { data: coords },
    { data: menus },
  ] = await Promise.all([
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
      .select("id, storage_path, alt, category")
      .eq("restaurant_id", id)
      .order("position"),
    // `location` es geography y PostgREST la devuelve en hexadecimal, que no
    // sirve para llenar dos campos. La función la traduce a lat/lng.
    supabase.rpc("restaurant_coords", { rid: id }),
    supabase
      .from("menus")
      .select("id, name, is_visible")
      .eq("restaurant_id", id)
      .order("position"),
  ]);

  const conUrl = (fotos ?? []).map((f) => ({
    ...f,
    url: supabase.storage.from(BUCKET_FOTOS).getPublicUrl(f.storage_path).data
      .publicUrl,
  }));

  const publicado = restaurante.status === "publicado";
  const cupoMenus = menusIncluidos(restaurante);
  const visibles = (menus ?? []).filter((m) => m.is_visible).length;

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

        {/* Los menús y las fotos van dentro del componente del formulario, no
            después: así el botón de guardar puede quedar al final de todo. */}
        <EditarForm
          restaurante={restaurante}
          cuisines={cuisines ?? []}
          elegidas={(elegidas ?? []).map((e) => e.cuisines?.slug).filter(Boolean)}
          horarios={horarios ?? []}
          coords={coords?.[0] ?? null}
        >

          <section className="bloque-menu">
            <div className="bloque-menu-cabeza">
              <h2 className="sub">Menús</h2>
              <span className="cupo">
                {(menus ?? []).length} de {cupoMenus}
              </span>
            </div>
            <p className="ayuda">
              La carta, las bebidas, el menú del día: cada uno es un menú aparte.
              Los capturas por secciones o subes el tuyo en PDF.
            </p>

            {menus?.length ? (
              <ul className="lista-menus-mini">
                {menus.map((m) => (
                  <li key={m.id}>
                    <Link href={`/panel/${restaurante.id}/menus/${m.id}`}>{m.name}</Link>
                    {m.is_visible ? null : <span className="estado">Oculto</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nota-borrador">
                Todavía no hay ningún menú. Sin menú, la ficha se ve a medias.
              </p>
            )}

            {menus?.length && visibles === 0 ? (
              <p className="nota-borrador">
                Los tienes todos ocultos: la ficha aparece sin menú.
              </p>
            ) : null}

            <Link className="btn" href={`/panel/${restaurante.id}/menus`}>
              {menus?.length ? "Administrar los menús" : "Crear el primer menú"}
            </Link>
          </section>

          <Fotos
            id={restaurante.id}
            fotos={conUrl}
            cupoPlatillos={fotosPlatillosIncluidas(restaurante)}
          />
        </EditarForm>
      </main>
    </div>
  );
}
