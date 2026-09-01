import Link from "next/link";
import { supabaseServer } from "../lib/supabase";
import Brand from "./brand";
import Buscador from "./buscador";
import Orden from "./orden";
import Waitlist from "./waitlist";

// La portada es la búsqueda: quien llega quiere ver dónde comer, no leer
// sobre el producto. El texto de venta queda debajo, para quien baje.
export const metadata = {
  title: "Menú Abierto — encuentra dónde comer, y haz que te encuentren",
  description:
    "Busca restaurantes por colonia, zona, municipio o estado, o encuentra los más cercanos a ti, con su menú y sus precios de verdad.",
};

// Depende de lo que traiga la URL, así que se resuelve en cada visita.
export const dynamic = "force-dynamic";

const BUCKET_FOTOS = "restaurantes";
const PRECIO = ["", "$", "$$", "$$$", "$$$$"];
const OWNER = [
  {
    icon: "✎",
    title: "Tú mandas en tu carta",
    body: "Cambia precios, agota un platillo o publica el menú del día desde el celular. Se ve al instante.",
  },
  {
    icon: "▣",
    title: "Fotos y video",
    body: "Sube tus mejores imágenes y clips cortos del local y de la cocina. Es lo primero que mira quien busca.",
  },
  {
    icon: "★",
    title: "Aparece arriba",
    body: "Con Premium ganas posición destacada en las búsquedas de tu zona, perfil ampliado y estadísticas de visitas.",
  },
];

const STEPS = [
  {
    title: "Reclama tu restaurante",
    body: "Creas tu cuenta y verificas que el negocio es tuyo. Sin costo.",
  },
  {
    title: "Publica tu menú",
    body: "Cargas platillos, precios y fotos. Puedes empezar con diez y crecer después.",
  },
  {
    title: "Mantenlo vivo",
    body: "Actualizas cuando cambien tus precios. Quien te busca ve siempre lo correcto.",
  },
];

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
  return cadena ? `/?${cadena}` : "/";
}

export default async function Home({ searchParams }) {
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
            <Link className="hide-sm" href="#restaurantes">
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
              <Link className="btn" href="/">
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


      <section id="restaurantes">
        <div className="wrap section">
          <div className="section-head">
            <h2>¿Tienes un restaurante?</h2>
            <p>
              Tu carta deja de vivir en una foto borrosa de hace dos años. La
              controlas tú, desde tu cuenta, cuando quieras.
            </p>
          </div>
          <div className="cards">
            {OWNER.map((c) => (
              <article className="card" key={c.title}>
                <div className="card-icon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
          <div className="section-cta">
            <Link className="btn" href="/registro">
              Publica tu menú gratis
            </Link>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap section">
          <div className="section-head">
            <h2>Publicar toma una tarde</h2>
            <p>Y actualizar, menos de un minuto.</p>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planes">
        <div className="wrap section">
          <div className="section-head">
            <h2>Dos planes, sin letras chiquitas</h2>
            <p>
              Publicar tu restaurante no cuesta. Premium es para cuando quieras
              destacar.
            </p>
          </div>
          <div className="plans">
            <article className="plan">
              <h3>Básico</h3>
              <div className="plan-price">
                Gratis <span>para siempre</span>
              </div>
              <ul>
                <li>Perfil del restaurante con ubicación y horarios</li>
                <li>Menú completo con precios</li>
                <li>Hasta 10 fotos</li>
                <li>Aparece en las búsquedas de tu zona</li>
              </ul>
            </article>
            <article className="plan plan-featured">
              <span className="plan-badge">Premium</span>
              <h3>Premium</h3>
              <div className="plan-price">
                Mensual <span>precio al lanzamiento</span>
              </div>
              <ul>
                <li>Todo lo del plan Básico</li>
                <li>Posición destacada en tu zona y tu categoría</li>
                <li>Fotos ilimitadas y video del local</li>
                <li>Promociones y menú del día</li>
                <li>Estadísticas de visitas y búsquedas</li>
              </ul>
            </article>
          </div>
          <p className="plan-note">
            Definiremos el precio de Premium antes del lanzamiento. Quien esté
            en la lista de espera lo conserva el primer año.
          </p>
        </div>
      </section>

      <section className="band" id="lista">
        <div className="wrap cta">
          <h2>Avísame cuando llegue a mi ciudad</h2>
          <p>
            Estamos armando el directorio ciudad por ciudad. Déjanos tu correo y
            te escribimos cuando toque la tuya.
          </p>
          <Waitlist />
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span>© {new Date().getFullYear()} Menú Abierto</span>
          <a href="mailto:hola@menuabierto.com">hola@menuabierto.com</a>
        </div>
      </footer>
    </>
  );
}
