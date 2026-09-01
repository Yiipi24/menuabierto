import Link from "next/link";
import { supabaseServer } from "../../lib/supabase";
import Brand from "../brand";
import Buscador from "./buscador";
import Orden from "./orden";

export const metadata = {
  title: "Explorar restaurantes — Menú Abierto",
  description:
    "Busca restaurantes por colonia, zona, municipio o estado, o encuentra los más cercanos a ti con su menú y sus precios.",
};

// La búsqueda depende de lo que traiga la URL, así que se resuelve en cada
// visita en vez de quedar congelada como la portada.
export const dynamic = "force-dynamic";

const BUCKET_FOTOS = "restaurantes";
const PRECIO = ["", "$", "$$", "$$$", "$$$$"];
const RADIO_M = 15000;

function distancia(metros) {
  if (metros == null) return null;
  return metros < 950
    ? `${Math.round(metros / 10) * 10} m`
    : `${(metros / 1000).toFixed(1)} km`;
}

function lugarDe(r) {
  return [r.neighborhood, r.city].filter(Boolean).join(" · ");
}

// Los filtros se llevan en la URL para que una búsqueda se pueda compartir y
// para que el botón "atrás" del navegador haga lo esperado.
function hrefCon(params, cambios) {
  const siguiente = new URLSearchParams(params);
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === null || valor === "") siguiente.delete(clave);
    else siguiente.set(clave, valor);
  }
  const cadena = siguiente.toString();
  return cadena ? `/explorar?${cadena}` : "/explorar";
}

export default async function Explorar({ searchParams }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const lugar = typeof sp.lugar === "string" ? sp.lugar : "";
  const cocina = typeof sp.cocina === "string" ? sp.cocina : "";
  const abierto = sp.abierto === "1";
  const precio = Number(sp.precio) || null;
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const conUbicacion = Number.isFinite(lat) && Number.isFinite(lng) && sp.lat && sp.lng;
  const orden = ["relevancia", "cercanos", "calificacion"].includes(sp.orden)
    ? sp.orden
    : conUbicacion
      ? "cercanos"
      : "relevancia";

  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(sp)) {
    if (typeof valor === "string" && valor !== "") params.set(clave, valor);
  }

  let resultados = [];
  let categorias = [];
  let fallo = false;

  try {
    const supabase = supabaseServer();

    const [busqueda, usadas] = await Promise.all([
      supabase.rpc("search_restaurants", {
        lat: conUbicacion ? lat : null,
        lng: conUbicacion ? lng : null,
        radius_m: RADIO_M,
        cuisine_slugs: cocina ? [cocina] : null,
        max_price_level: precio,
        min_rating: null,
        open_now: abierto,
        search_text: q || null,
        place_text: lugar || null,
        sort_by: orden,
        result_limit: 48,
        result_offset: 0,
      }),
      // Las categorías que se ofrecen son las que de verdad tiene alguien
      // publicado: un filtro que siempre devuelve cero no ayuda a nadie.
      supabase.from("restaurant_cuisines").select("cuisines (slug, name)"),
    ]);

    if (busqueda.error) fallo = true;
    resultados = busqueda.data ?? [];

    const vistas = new Map();
    for (const fila of usadas.data ?? []) {
      const c = fila.cuisines;
      if (c && !vistas.has(c.slug)) vistas.set(c.slug, c.name);
    }
    categorias = [...vistas.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .slice(0, 10);

    // Una sola consulta para las fotos de todos los resultados, y no una por
    // tarjeta: con veinte restaurantes serían veinte viajes a la base.
    if (resultados.length) {
      const { data: fotos } = await supabase
        .from("restaurant_media")
        .select("restaurant_id, storage_path, position")
        .in(
          "restaurant_id",
          resultados.map((r) => r.id),
        )
        .order("position");

      const primera = new Map();
      for (const f of fotos ?? []) {
        if (!primera.has(f.restaurant_id)) primera.set(f.restaurant_id, f.storage_path);
      }
      resultados = resultados.map((r) => {
        const ruta = primera.get(r.id);
        return {
          ...r,
          foto: ruta
            ? supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl
            : null,
        };
      });
    }
  } catch {
    fallo = true;
  }

  const hayFiltros = Boolean(q || lugar || cocina || abierto || precio || conUbicacion);

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Brand />
          <div className="nav-links">
            <Link className="nav-activo" href="/explorar">
              Explorar
            </Link>
            <Link className="hide-sm" href="/#restaurantes">
              Para restaurantes
            </Link>
            <Link className="hide-sm" href="/entrar">
              Iniciar sesión
            </Link>
            <Link className="btn btn-sm" href="/registro">
              Publica tu menú
            </Link>
          </div>
        </div>
      </nav>

      <header className="explorar-hero">
        <div className="wrap">
          <h1>¿Qué se te antoja hoy?</h1>
          <p className="explorar-sub">
            Encuentra restaurantes, platillos y menús cerca de ti.
          </p>
          <Buscador q={q} lugar={lugar} conUbicacion={Boolean(conUbicacion)} />

          <div className="chips-filtro">
            {categorias.map((c) => (
              <Link
                key={c.slug}
                className={c.slug === cocina ? "chip-filtro chip-on" : "chip-filtro"}
                href={hrefCon(params, { cocina: c.slug === cocina ? null : c.slug })}
              >
                {c.name}
              </Link>
            ))}
            <Link
              className={abierto ? "chip-filtro chip-on" : "chip-filtro"}
              href={hrefCon(params, { abierto: abierto ? null : "1" })}
            >
              Abierto ahora
            </Link>
            {[1, 2, 3].map((p) => (
              <Link
                key={p}
                className={precio === p ? "chip-filtro chip-on" : "chip-filtro"}
                href={hrefCon(params, { precio: precio === p ? null : String(p) })}
              >
                {PRECIO[p]} o menos
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="wrap explorar-main">
        <div className="explorar-encabezado">
          <h2>
            {conUbicacion
              ? "Restaurantes cerca de ti"
              : lugar
                ? `Restaurantes en ${lugar}`
                : "Restaurantes publicados"}
            <span className="explorar-cuenta">
              {resultados.length === 1 ? "1 resultado" : `${resultados.length} resultados`}
            </span>
          </h2>
          <Orden valor={orden} />
        </div>

        {fallo ? (
          <p className="form-msg err">
            No pudimos cargar la búsqueda. Vuelve a intentarlo en un momento.
          </p>
        ) : resultados.length === 0 ? (
          <div className="explorar-vacio">
            <h3>Todavía no hay nada que coincida</h3>
            <p>
              Menú Abierto está creciendo ciudad por ciudad. Prueba con menos
              filtros, o escribe otra colonia o municipio.
            </p>
            {hayFiltros ? (
              <Link className="btn" href="/explorar">
                Ver todos los restaurantes
              </Link>
            ) : (
              <Link className="btn" href="/registro">
                Publica tu restaurante
              </Link>
            )}
          </div>
        ) : (
          <div className="tarjetas">
            {resultados.map((r) => (
              <Link className="tarjeta" key={r.id} href={`/r/${r.slug}`}>
                <div className="tarjeta-foto">
                  {r.foto ? (
                    <img src={r.foto} alt="" loading="lazy" />
                  ) : (
                    <span className="tarjeta-sinfoto" aria-hidden="true">
                      🍽
                    </span>
                  )}
                  {r.distance_m != null ? (
                    <span className="tarjeta-distancia">{distancia(r.distance_m)}</span>
                  ) : null}
                  {r.is_open_now ? <span className="tarjeta-abierto">Abierto ahora</span> : null}
                </div>
                <div className="tarjeta-cuerpo">
                  <div className="tarjeta-titulo">
                    <h3>{r.name}</h3>
                    {r.rating_count > 0 && r.rating_avg ? (
                      <span className="tarjeta-rating">★ {r.rating_avg}</span>
                    ) : null}
                  </div>
                  <p className="tarjeta-tipo">
                    {r.cuisines?.length ? r.cuisines.join(" · ") : r.summary || "Restaurante"}
                  </p>
                  <p className="tarjeta-meta">
                    <span>◎ {lugarDe(r) || "México"}</span>
                    {r.price_level ? <span>{PRECIO[r.price_level]}</span> : null}
                  </p>
                </div>
                <span className="tarjeta-pie">Ver menú →</span>
              </Link>
            ))}
          </div>
        )}
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
