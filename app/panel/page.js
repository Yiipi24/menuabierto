import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../lib/supabase";
import { cerrarSesion, cambiarEstado, borrarRestaurante } from "./actions";
import Brand from "../brand";
import BorrarRestaurante from "./borrar";

export const metadata = { title: "Tu panel — Menú Abierto" };

const ETIQUETA_ESTADO = {
  borrador: "Borrador",
  publicado: "Publicado",
  oculto: "Oculto",
};

export default async function Panel() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // La RLS ya limita esto a los restaurantes de quien está firmado; el filtro
  // explícito sobra por seguridad pero deja clara la intención al leer.
  const { data: restaurantes, error } = await supabase
    .from("restaurants")
    .select("id, slug, name, city, neighborhood, status, rating_avg, rating_count")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/" />
        <div className="panel-top-derecha">
          <Link className="btn-texto" href="/panel/planes">
            Planes
          </Link>
          <Link className="btn-texto" href="/panel/cuenta">
            {auth.user.email}
          </Link>
          <form action={cerrarSesion}>
            <button className="btn-texto" type="submit">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="wrap panel-main">
        <div className="panel-encabezado">
          <h1>Tus restaurantes</h1>
          <div className="panel-acciones">
            <Link className="btn-texto" href="/reclamar">
              Reclamar uno existente
            </Link>
            <Link className="btn" href="/panel/nuevo">
              Agregar restaurante
            </Link>
          </div>
        </div>

        {error ? (
          <p className="form-msg err">
            No pudimos cargar tus restaurantes. Recarga la página.
          </p>
        ) : null}

        {!error && restaurantes?.length === 0 ? (
          <div className="vacio">
            <h2>Todavía no tienes ninguno</h2>
            <p>
              Da de alta tu restaurante para empezar. Puedes guardarlo como
              borrador y publicarlo cuando el menú esté listo.
            </p>
            <Link className="btn" href="/panel/nuevo">
              Agregar el primero
            </Link>
          </div>
        ) : null}

        {restaurantes?.length ? (
          <ul className="lista-restaurantes">
            {restaurantes.map((r) => (
              <li key={r.id} className="fila-restaurante">
                <div>
                  <h2>{r.name}</h2>
                  <p className="fila-meta">
                    {[r.neighborhood, r.city].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="fila-derecha">
                  <span className={`estado estado-${r.status}`}>
                    {ETIQUETA_ESTADO[r.status] ?? r.status}
                  </span>
                  <span className="fila-rating">
                    {r.rating_count > 0
                      ? `★ ${r.rating_avg} · ${r.rating_count}`
                      : "Sin reseñas"}
                  </span>
                  <div className="fila-botones">
                    <Link className="btn-texto" href={`/panel/${r.id}`}>
                      Seguir editando
                    </Link>
                    <Link className="btn-texto" href={`/panel/${r.id}/menus`}>
                      Menús
                    </Link>
                    <form action={cambiarEstado}>
                      <input type="hidden" name="id" value={r.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={r.status === "publicado" ? "oculto" : "publicado"}
                      />
                      <button
                        className={r.status === "publicado" ? "btn-texto" : "btn btn-chico"}
                        type="submit"
                      >
                        {r.status === "publicado" ? "Ocultar" : "Publicar"}
                      </button>
                    </form>
                    <BorrarRestaurante id={r.id} nombre={r.name} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
