import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { menusIncluidos, fotosPlatillosIncluidas } from "../../../lib/planes";
import { catalogoDeServicios } from "../../../lib/servicios";
import { catalogoDePagos } from "../../../lib/pagos";
import EditarForm from "./form";
import Fotos from "./fotos";
import CabeceraPanel from "../cabecera";
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
      "id, name, summary, description, city, neighborhood, street, state, postal_code, phone, website, price_level, status, plan, premium_until, highlights, social_links, payment_methods, amenities, parking_cost, parking_kind, service_mode, closed_days, whatsapp_orders, whatsapp_phone, whatsapp_note",
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
    { data: platillos },
    { data: catalogoServicios },
    { data: catalogoPagos },
    { count: cupones },
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
      .select(
        "id, storage_path, alt, category, dish_name, dish_label, description, menu_item_id, is_featured, is_visible, position",
      )
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
    // Los platillos, solo id y nombre: son las opciones del selector con el
    // que una foto se cuelga de un platillo de la carta.
    supabase
      .from("menu_items")
      .select("id, name, menu_id")
      .eq("restaurant_id", id)
      .order("position")
      .order("created_at"),
    // El catálogo de servicios: el formulario pinta las casillas que haya en
    // la tabla, así que uno nuevo aparece aquí sin tocar el código.
    supabase.from("amenities").select("slug, name, hint, icon").order("position"),
    supabase.from("payment_methods").select("slug, name, hint, icon").order("position"),
    // Solo el número: la tarjeta de abajo dice cuántos hay encendidos y el
    // detalle vive en su propia pantalla.
    supabase
      .from("coupons")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", id)
      .eq("is_active", true),
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
      <CabeceraPanel correo={auth.user.email} usuarioId={auth.user.id} atras="/panel" />

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
          catalogoServicios={catalogoDeServicios(catalogoServicios ?? [])}
          catalogoPagos={catalogoDePagos(catalogoPagos ?? [])}
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

          {/* Los cupones cuelgan de los menús y no del tablero: son la otra
              cosa que el dueño publica en su ficha, y la que le dice cuántos
              de los que la vieron acabaron sentados en una mesa. */}
          <section className="bloque-qr">
            <div className="bloque-qr-texto">
              <h2 className="sub">Cupones</h2>
              <p className="ayuda">
                Una promoción con código se puede medir: sale en tu ficha, el
                cliente se lo lleva y lo dice en la caja.
                {cupones ? ` Tienes ${cupones} ${cupones === 1 ? "encendido" : "encendidos"}.` : ""}
              </p>
            </div>
            <Link className="btn" href={`/panel/${restaurante.id}/cupones`}>
              {cupones ? "Administrar los cupones" : "Crear un cupón"}
            </Link>
          </section>

          {/* El QR va junto a los menús y no en una pantalla escondida: es lo
              que el dueño imprime, y hasta que no lo imprime la ficha no llega
              a la mesa. Aquí solo el atajo; el código grande, sus descargas y
              los consejos de impresión viven en su propia pantalla. */}
          <section className="bloque-qr">
            <div className="bloque-qr-texto">
              <h2 className="sub">Tu código QR</h2>
              <p className="ayuda">
                Uno solo para todo el restaurante, y siempre el mismo. Pégalo en
                la mesa: quien lo escanea abre tu página con todos tus menús.
              </p>
            </div>
            <Link className="btn" href={`/panel/${restaurante.id}/qr`}>
              Ver y descargar el QR
            </Link>
          </section>

          <Fotos
            id={restaurante.id}
            fotos={conUrl}
            cupoPlatillos={fotosPlatillosIncluidas(restaurante)}
            platillos={(platillos ?? []).map((p) => ({
              id: p.id,
              nombre: p.name,
              carta: (menus ?? []).find((m) => m.id === p.menu_id)?.name ?? "",
            }))}
          />
        </EditarForm>
      </main>
    </div>
  );
}
