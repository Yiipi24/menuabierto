import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import Nav from "../nav";
import Feed from "./feed";
import { cargarFeed, misSeguidos } from "../_social/datos";

export const metadata = { title: "Novedades — Menú Abierto" };
export const dynamic = "force-dynamic";

// El portal del comensal: lo que publicaron los restaurantes que sigue, de lo
// más nuevo a lo más viejo.
//
// Pide sesión porque un feed de "los que sigues" sin cuenta no significa nada.
// El `next` lleva de vuelta aquí en cuanto entra.
export default async function Novedades() {
  const usuario = await currentUser();
  if (!usuario) redirect("/entrar?next=%2Fnovedades");

  const [feed, seguidos] = await Promise.all([cargarFeed(), misSeguidos()]);

  return (
    <>
      <Nav />

      <main className="feed">
        <div className="wrap">
          <header className="feed-encabezado">
            <div>
              <h1>Novedades</h1>
              <p>
                {seguidos.length
                  ? `De los ${seguidos.length} ${
                      seguidos.length === 1 ? "restaurante" : "restaurantes"
                    } que sigues.`
                  : "De los restaurantes que sigues."}
              </p>
            </div>
            <div className="feed-acciones">
              <Link className="btn-linea" href="/avisos">
                Tus avisos
              </Link>
              <Link className="btn-linea" href="/">
                Buscar restaurantes
              </Link>
            </div>
          </header>

          {feed.error ? (
            <p className="form-msg err">
              No pudimos cargar tus novedades. Recarga la página.
            </p>
          ) : null}

          {/* El estado vacío no es un cartel: es la puerta a lo único que se
              puede hacer desde aquí, que es encontrar a quién seguir. */}
          {!feed.error && !seguidos.length ? (
            <div className="vacio feed-vacio">
              <h2>Todavía no sigues a nadie</h2>
              <p>
                Sigue a tus restaurantes de siempre y aquí vas a ver sus
                historias, sus promociones y lo que salga del ahumador hoy.
              </p>
              <div className="feed-vacio-botones">
                <Link className="btn" href="/">
                  Descubrir restaurantes
                </Link>
                <Link className="btn-linea" href="/explorar">
                  Ver el mapa
                </Link>
              </div>
            </div>
          ) : null}

          {!feed.error && seguidos.length ? (
            <Feed historias={feed.historias} publicaciones={feed.publicaciones} />
          ) : null}

          {seguidos.length ? (
            <section className="feed-seguidos">
              <h2 className="sub">Los que sigues</h2>
              <ul className="feed-seguidos-lista">
                {seguidos.map((s) => (
                  <li key={s.id}>
                    <Link href={`/${s.slug}`}>{s.nombre}</Link>
                    {s.ciudad ? <span>{s.ciudad}</span> : null}
                    {s.alerta ? <em className="feed-alerta">Con avisos</em> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}
