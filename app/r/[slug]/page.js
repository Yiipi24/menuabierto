import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser, supabaseServer } from "../../../lib/supabase";
import Brand from "../../brand";
import Resenas from "./resenas";

export const dynamic = "force-dynamic";

const BUCKET_FOTOS = "restaurantes";
const PRECIO = ["", "$", "$$", "$$$", "$$$$"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function hora(t) {
  return typeof t === "string" ? t.slice(0, 5) : t;
}

function pesos(centavos, moneda = "MXN") {
  if (centavos == null) return null;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  }).format(centavos / 100);
}

async function cargar(slug) {
  const supabase = supabaseServer();

  // La RLS solo deja ver fichas publicadas, así que un borrador ajeno da 404
  // igual que un slug inventado: la página no revela que existe.
  const { data: r } = await supabase
    .from("restaurants")
    .select(
      "id, owner_id, slug, name, summary, description, price_level, phone, website, street, neighborhood, city, state, postal_code, rating_avg, rating_count",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!r) return null;

  const [cocinas, horarios, fotos, secciones, platillos, abierto, resenas] = await Promise.all([
    supabase.from("restaurant_cuisines").select("cuisines (name)").eq("restaurant_id", r.id),
    supabase
      .from("restaurant_hours")
      .select("weekday, opens, closes")
      .eq("restaurant_id", r.id)
      .order("weekday"),
    supabase
      .from("restaurant_media")
      .select("storage_path, alt")
      .eq("restaurant_id", r.id)
      .order("position"),
    supabase
      .from("menu_sections")
      .select("id, name, position")
      .eq("restaurant_id", r.id)
      .order("position"),
    supabase
      .from("menu_items")
      .select("id, section_id, name, description, price_cents, currency, is_available, position")
      .eq("restaurant_id", r.id)
      .order("position"),
    supabase.rpc("restaurant_abierto", { rid: r.id }),
    // Por RPC y no por join: profiles es privado, y esta funcion devuelve el
    // nombre de quien firma sin abrir el resto del perfil.
    supabase.rpc("resenas_restaurante", { rid: r.id }),
  ]);

  return {
    r,
    cocinas: (cocinas.data ?? []).map((c) => c.cuisines?.name).filter(Boolean),
    horarios: horarios.data ?? [],
    fotos: (fotos.data ?? []).map((f) => ({
      ...f,
      url: supabase.storage.from(BUCKET_FOTOS).getPublicUrl(f.storage_path).data.publicUrl,
    })),
    secciones: secciones.data ?? [],
    platillos: platillos.data ?? [],
    abierto: abierto.data === true,
    resenas: resenas.data ?? [],
  };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const datos = await cargar(slug);
    if (!datos) return { title: "Restaurante no encontrado — Menú Abierto" };
    const { r } = datos;
    const lugar = [r.neighborhood, r.city].filter(Boolean).join(", ");
    return {
      title: `${r.name} — menú y precios | Menú Abierto`,
      description:
        r.summary || `Menú, precios y ubicación de ${r.name}${lugar ? ` en ${lugar}` : ""}.`,
    };
  } catch {
    return { title: "Menú Abierto" };
  }
}

export default async function Ficha({ params }) {
  const { slug } = await params;

  let datos = null;
  try {
    datos = await cargar(slug);
  } catch {
    datos = null;
  }
  if (!datos) notFound();

  const { r, cocinas, horarios, fotos, secciones, platillos, abierto, resenas } = datos;

  // La ficha es publica, asi que la sesion puede no existir. Solo sirve para
  // decidir que se ve bajo las resenas: el formulario, la puerta de entrada o
  // el aviso al dueno.
  const usuario = await currentUser();
  const esDueno = Boolean(usuario && r.owner_id === usuario.id);

  // Un platillo sin sección va a un grupo propio al final, en vez de
  // desaparecer de la carta.
  const grupos = [
    ...secciones.map((s) => ({
      id: s.id,
      name: s.name,
      items: platillos.filter((p) => p.section_id === s.id),
    })),
    {
      id: "sin-seccion",
      name: secciones.length ? "Otros platillos" : "Menú",
      items: platillos.filter((p) => !p.section_id),
    },
  ].filter((g) => g.items.length);

  const direccion = [r.street, r.neighborhood, r.city, r.state, r.postal_code]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Brand />
          <div className="nav-links">
            <Link href="/">Buscar</Link>
            <Link className="btn btn-sm" href="/registro">
              Publica tu menú
            </Link>
          </div>
        </div>
      </nav>

      <main className="wrap ficha">
        <Link className="btn-texto ficha-volver" href="/">
          ← Volver a la búsqueda
        </Link>

        <header className="ficha-encabezado">
          <div>
            <h1>{r.name}</h1>
            <p className="ficha-tipo">
              {cocinas.length ? cocinas.join(" · ") : r.summary || "Restaurante"}
              {r.price_level ? ` · ${PRECIO[r.price_level]}` : ""}
            </p>
            <p className="ficha-meta">
              {abierto ? (
                <span className="ficha-abierto">Abierto ahora</span>
              ) : horarios.length ? (
                <span className="ficha-cerrado">Cerrado ahora</span>
              ) : null}
              {r.rating_count > 0 && r.rating_avg ? (
                <a className="ficha-resenas-enlace" href="#resenas">
                  ★ {r.rating_avg} · {r.rating_count}{" "}
                  {r.rating_count === 1 ? "reseña" : "reseñas"}
                </a>
              ) : (
                <a className="ficha-sinresenas" href="#resenas">
                  Aún sin reseñas · escribe la primera
                </a>
              )}
            </p>
          </div>
        </header>

        {fotos.length ? (
          <div className="ficha-fotos">
            {fotos.slice(0, 6).map((f) => (
              <img key={f.storage_path} src={f.url} alt={f.alt ?? ""} loading="lazy" />
            ))}
          </div>
        ) : null}

        <div className="ficha-cols">
          <div>
            {r.description ? <p className="ficha-desc">{r.description}</p> : null}

            <h2 className="ficha-titulo">Menú</h2>
            {grupos.length ? (
              grupos.map((g) => (
                <section className="menu-seccion" key={g.id}>
                  <h3>{g.name}</h3>
                  <ul className="menu-lista">
                    {g.items.map((p) => (
                      <li
                        className={p.is_available ? "menu-item" : "menu-item menu-agotado"}
                        key={p.id}
                      >
                        <div>
                          <span className="menu-nombre">{p.name}</span>
                          {p.description ? (
                            <span className="menu-desc">{p.description}</span>
                          ) : null}
                          {!p.is_available ? (
                            <span className="menu-etiqueta">Agotado hoy</span>
                          ) : null}
                        </div>
                        <span className="menu-precio">
                          {pesos(p.price_cents, p.currency) ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <p className="ficha-vacio">
                Este restaurante todavía no publica su menú. Vuelve pronto.
              </p>
            )}

            <Resenas
              slug={slug}
              restaurante={r}
              resenas={resenas}
              usuarioId={usuario?.id ?? null}
              esDueno={esDueno}
            />
          </div>

          <aside className="ficha-lado">
            <div className="ficha-card">
              <h3>Dónde está</h3>
              <p>{direccion || "Ubicación no publicada"}</p>
              {direccion ? (
                <a
                  className="btn btn-sm btn-block"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${r.name} ${direccion}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cómo llegar
                </a>
              ) : null}
            </div>

            {r.phone || r.website ? (
              <div className="ficha-card">
                <h3>Contacto</h3>
                {r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : null}
                {r.website ? (
                  <a href={r.website} target="_blank" rel="noopener noreferrer">
                    Sitio web
                  </a>
                ) : null}
              </div>
            ) : null}

            {horarios.length ? (
              <div className="ficha-card">
                <h3>Horarios</h3>
                <ul className="ficha-horarios">
                  {horarios.map((h, i) => (
                    <li key={`${h.weekday}-${i}`}>
                      <span>{DIAS[h.weekday]}</span>
                      <span>
                        {hora(h.opens)} – {hora(h.closes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
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
