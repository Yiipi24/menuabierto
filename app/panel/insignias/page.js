import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { rutaFicha } from "../../../lib/slug";
import { INSIGNIAS, conteoDe, progresoDe } from "../../../lib/insignias";
import { IconoInsignia } from "../../insignias-iconos";
import Brand from "../../brand";

export const metadata = { title: "Tus insignias — Menú Abierto" };

const FECHA = new Intl.DateTimeFormat("es-MX", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function fecha(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : FECHA.format(d);
}

export default async function Insignias() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar?next=/panel/insignias");

  const [{ data: perfil }, { data: mias }] = await Promise.all([
    supabase
      .from("profiles")
      .select("reviews_count")
      .eq("id", auth.user.id)
      .maybeSingle(),
    // La lista es de las fichas publicadas: la RLS de reviews no deja ver las
    // de un restaurante oculto, ni siquiera las propias. El contador del
    // perfil sí las cuenta todas, así que puede ir por delante de esta lista;
    // es preferible a que una insignia ganada se pierda porque el dueño
    // escondió su ficha una semana.
    supabase
      .from("reviews")
      .select("id, rating, body, created_at, restaurants (name, slug, city)")
      .eq("author_id", auth.user.id)
      .order("created_at", { ascending: false }),
  ]);

  const total = conteoDe(perfil?.reviews_count);
  const { actual, siguiente, faltan, porcentaje } = progresoDe(total);
  const resenas = mias ?? [];

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href="/panel">
          Volver
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <h1>Tus insignias</h1>
        <p className="panel-lead">
          Cada reseña que escribes ayuda a que alguien elija bien dónde comer.
          Estas son las metas que vas alcanzando por hacerlo.
        </p>

        {/* El marcador va primero y en grande: es la respuesta a "¿cuántas
            llevo y cuánto me falta?", que es a lo que se entra a esta página. */}
        <section className="insignias-marcador">
          <div className="insignias-marcador-cifra">
            <strong>{total}</strong>
            <span>{total === 1 ? "reseña escrita" : "reseñas escritas"}</span>
          </div>

          <div className="insignias-marcador-actual">
            {actual ? (
              <>
                <span className="insignia-medalla insignia-medalla-on">
                  <IconoInsignia slug={actual.slug} ancho={30} />
                </span>
                <div>
                  <strong>{actual.nombre}</strong>
                  <span>{actual.lema}</span>
                </div>
              </>
            ) : (
              <div>
                <strong>Todavía sin insignia</strong>
                <span>La primera reseña ya te da una.</span>
              </div>
            )}
          </div>
        </section>

        {siguiente ? (
          <section className="insignias-avance">
            <div className="insignias-avance-cabeza">
              <span>
                Siguiente: <strong>{siguiente.nombre}</strong>
              </span>
              <span className="insignias-avance-faltan">
                {faltan === 1 ? "Te falta 1 reseña" : `Te faltan ${faltan} reseñas`}
              </span>
            </div>
            <div
              className="insignias-barra"
              role="progressbar"
              aria-valuenow={total}
              aria-valuemin={0}
              aria-valuemax={siguiente.meta}
              aria-label={`Avance hacia ${siguiente.nombre}`}
            >
              <span style={{ width: `${porcentaje}%` }} />
            </div>
          </section>
        ) : (
          <p className="form-msg ok">
            Tienes todas las insignias. Gracias: muy poca gente llega hasta aquí.
          </p>
        )}

        <h2 className="sub">Todas las metas</h2>
        {/* Las que faltan se enseñan apagadas y no escondidas: saber cuál sigue
            es justo lo que hace que la siguiente reseña se escriba. */}
        <ul className="insignias-rejilla">
          {INSIGNIAS.map((insignia) => {
            const ganada = total >= insignia.meta;
            return (
              <li
                className={
                  ganada
                    ? "insignia-tarjeta insignia-tarjeta-ganada"
                    : "insignia-tarjeta"
                }
                key={insignia.slug}
              >
                <span
                  className={
                    ganada ? "insignia-medalla insignia-medalla-on" : "insignia-medalla"
                  }
                >
                  <IconoInsignia slug={insignia.slug} ancho={26} />
                </span>
                <div className="insignia-texto">
                  <strong>{insignia.nombre}</strong>
                  <span className="insignia-meta">
                    {insignia.meta === 1
                      ? "Con 1 reseña"
                      : `Con ${insignia.meta} reseñas`}
                  </span>
                  <p>{insignia.descripcion}</p>
                  {/* Debajo del texto y no al lado: en una tarjeta angosta, el
                      sello y la descripción se peleaban el ancho y la dejaban
                      en tres palabras por renglón. */}
                  {ganada ? <span className="insignia-sello">Ganada</span> : null}
                </div>
              </li>
            );
          })}
        </ul>

        <h2 className="sub">Tus reseñas</h2>
        {resenas.length ? (
          <ul className="mis-resenas">
            {resenas.map((r) => (
              <li key={r.id}>
                <div className="mis-resenas-cabeza">
                  {r.restaurants?.slug ? (
                    <Link href={rutaFicha(r.restaurants.slug)}>{r.restaurants.name}</Link>
                  ) : (
                    <span>{r.restaurants?.name ?? "Restaurante"}</span>
                  )}
                  <span className="mis-resenas-fecha">{fecha(r.created_at)}</span>
                </div>
                <span className="estrellas" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= r.rating ? "estrella-llena" : "estrella-vacia"}>
                      ★
                    </span>
                  ))}
                </span>
                <span className="sr-only">{r.rating} de 5</span>
                {r.body ? <p className="mis-resenas-texto">{r.body}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="vacio">
            <p>
              Todavía no escribes ninguna. Busca un lugar donde ya hayas comido y
              cuenta cómo te fue: esa es tu primera insignia.
            </p>
            <Link className="btn" href="/">
              Buscar un restaurante
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
