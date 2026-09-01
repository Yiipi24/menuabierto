import Link from "next/link";
import Waitlist from "./waitlist";
import { supabaseServer } from "../lib/supabase";

// Mientras no haya ninguna ficha publicada, el teléfono de la portada enseña
// estos ejemplos. En cuanto exista el primer restaurante real, se muestran los
// reales y estos dejan de usarse.
const DEMO_RESULTS = [
  {
    name: "Taquería La Esquina",
    kind: "Tacos · $$",
    rating: "4.8",
    tag: "A 350 m",
  },
  {
    name: "Cocina de Doña Mari",
    kind: "Comida corrida · $",
    rating: "4.7",
    tag: "Menú del día",
  },
  {
    name: "Verde Limón",
    kind: "Vegetariano · $$",
    rating: "4.6",
    tag: "Abierto ahora",
  },
  {
    name: "Sazón del Puerto",
    kind: "Mariscos · $$$",
    rating: "4.5",
    tag: "A 1.2 km",
  },
];

// La portada se genera estática; sin esto el primer restaurante publicado no
// aparecería hasta el siguiente despliegue.
export const revalidate = 300;

const PRECIO = ["", "$", "$$", "$$$", "$$$$"];

// La portada es pública, así que basta el cliente sin sesión: la RLS deja ver
// a cualquiera los restaurantes en estado 'publicado'.
async function restaurantesPublicados() {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from("restaurants")
      .select(
        "id, slug, name, summary, city, neighborhood, price_level, rating_avg, rating_count, restaurant_cuisines(cuisines(name))",
      )
      .eq("status", "publicado")
      .order("created_at", { ascending: false })
      .limit(4);

    if (error) return [];
    return data ?? [];
  } catch {
    // Sin variables de entorno (build local, previsualización) la portada
    // sigue funcionando con los ejemplos.
    return [];
  }
}

function aResultado(r) {
  const cocina = r.restaurant_cuisines?.[0]?.cuisines?.name;
  const precio = PRECIO[r.price_level] ?? "";
  const kind = [cocina || r.summary, precio].filter(Boolean).join(" · ");

  return {
    slug: r.slug,
    name: r.name,
    kind: kind || "Restaurante",
    rating: r.rating_count > 0 && r.rating_avg ? String(r.rating_avg) : null,
    tag: [r.neighborhood, r.city].filter(Boolean).join(", ") || "Nuevo",
  };
}

const DINER = [
  {
    icon: "◎",
    title: "Cerca de ti",
    body: "Resultados ordenados por distancia real, con lo que está abierto en este momento hasta arriba.",
  },
  {
    icon: "◇",
    title: "Como se te antoje",
    body: "Filtra por tipo de comida, rango de precio, calificación, o lo que tú necesites: vegetariano, sin gluten, para llevar.",
  },
  {
    icon: "☰",
    title: "El menú de verdad",
    body: "Precios actualizados por el propio restaurante, con fotos de los platos. Decides antes de salir de casa.",
  },
];

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

export default async function Home() {
  const publicados = await restaurantesPublicados();
  const hayPublicados = publicados.length > 0;
  const results = hayPublicados ? publicados.map(aResultado) : DEMO_RESULTS;

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top">
            <img
              className="brand-mark"
              src="/logo.svg"
              alt=""
              width={28}
              height={28}
            />
            Menú Abierto
          </a>
          <div className="nav-links">
            <Link href="/explorar">Explorar</Link>
            <a className="hide-sm" href="/entrar">
              Entrar
            </a>
            <a className="btn btn-sm" href="/registro">
              Crear cuenta
            </a>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">
              {hayPublicados
                ? "Ya hay restaurantes en Menú Abierto"
                : "Muy pronto en México"}
            </span>
            <h1>
              Encuentra dónde comer. <em>Haz que te encuentren.</em>
            </h1>
            <p className="hero-sub">
              Menú Abierto reúne los restaurantes de tu ciudad con su menú y sus
              precios de verdad. Los comensales buscan y comparan; los dueños
              publican y actualizan desde su cuenta.
            </p>
            {hayPublicados ? (
              <div className="hero-acciones">
                <Link className="btn" href="/explorar">
                  Explorar restaurantes
                </Link>
                <a className="btn-texto" href="#lista">
                  Avísame de los nuevos
                </a>
              </div>
            ) : (
              <a className="btn" href="#lista">
                Entrar a la lista de espera
              </a>
            )}
            <p className="hero-note">
              Gratis para comensales. Gratis para publicar tu restaurante.
            </p>
          </div>

          <div className="phone" aria-hidden={hayPublicados ? undefined : "true"}>
            <div className="phone-head">
              <strong>Buscar cerca de mí</strong>
              <span>
                {hayPublicados
                  ? "Restaurantes publicados en Menú Abierto"
                  : "Tacos · abierto ahora · 4.5+"}
              </span>
            </div>
            <div className="phone-body">
              {results.map((r) => {
                const fila = (
                  <>
                    <div className="result-thumb" />
                    <div className="result-text">
                      <div className="dish-name">{r.name}</div>
                      <div className="dish-desc">{r.kind}</div>
                      <div className="result-tag">{r.tag}</div>
                    </div>
                    {r.rating ? (
                      <div className="result-rating">★ {r.rating}</div>
                    ) : null}
                  </>
                );

                // Los ejemplos son decorativos y no llevan a ningún lado; un
                // restaurante de verdad sí abre su ficha, que es lo que
                // cualquiera intenta al verlo en la lista.
                return r.slug ? (
                  <Link className="result result-link" key={r.slug} href={`/r/${r.slug}`}>
                    {fila}
                  </Link>
                ) : (
                  <div className="result" key={r.name}>
                    {fila}
                  </div>
                );
              })}
            </div>
            {hayPublicados ? (
              <Link className="phone-pie" href="/explorar">
                Ver todos los restaurantes →
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="band" id="comensales">
        <div className="wrap section">
          <div className="section-head">
            <h2>Para quien tiene hambre</h2>
            <p>
              Dejas de abrir cinco apps y cuatro perfiles de redes para saber si
              un lugar sigue abierto y cuánto cuesta.
            </p>
          </div>
          <div className="cards">
            {DINER.map((c) => (
              <article className="card" key={c.title}>
                <div className="card-icon">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="restaurantes">
        <div className="wrap section">
          <div className="section-head">
            <h2>Para quien cocina</h2>
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

      {hayPublicados ? (
        <section className="wrap">
          <div className="aviso-explorar">
            <div>
              <h2>Ya hay restaurantes en Menú Abierto</h2>
              <p>Explora sus menús, precios y ubicaciones.</p>
            </div>
            <Link className="btn" href="/explorar">
              Ver todos los restaurantes →
            </Link>
          </div>
        </section>
      ) : null}

      <section className="band" id="lista">
        <div className="wrap cta">
          <h2>Avísame cuando abra</h2>
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
