import Link from "next/link";
import ResenaForm from "./resena-form";

const FECHA = new Intl.DateTimeFormat("es-MX", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function fecha(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : FECHA.format(d);
}

// Las estrellas son decorativas: el número al lado ya dice la calificación, y
// repetirla cinco veces en el lector de pantalla solo estorba.
function Estrellas({ valor }) {
  const llenas = Math.round(valor);
  return (
    <span className="estrellas" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= llenas ? "estrella-llena" : "estrella-vacia"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function Resenas({ slug, restaurante, resenas, usuarioId, esDueno }) {
  const total = resenas.length;
  const promedio = restaurante.rating_avg ?? null;
  const volverAqui = `/r/${encodeURIComponent(slug)}#resenas`;

  // La propia sube al formulario, donde se edita; repetirla abajo la mostraria
  // dos veces en la misma pantalla.
  const mia = usuarioId ? resenas.find((r) => r.author_id === usuarioId) ?? null : null;
  const deOtros = mia ? resenas.filter((r) => r.author_id !== usuarioId) : resenas;

  return (
    <section className="resenas" id="resenas">
      <h2 className="ficha-titulo">Reseñas</h2>

      {total ? (
        <div className="resenas-resumen">
          <strong>{promedio ?? "—"}</strong>
          <div>
            <Estrellas valor={promedio ?? 0} />
            <span className="resenas-conteo">
              {total} {total === 1 ? "reseña" : "reseñas"}
            </span>
          </div>
        </div>
      ) : (
        <p className="ficha-vacio">
          Todavía nadie reseña este lugar. Si ya comiste aquí, tu reseña es la
          primera que van a leer los demás.
        </p>
      )}

      {esDueno ? (
        <p className="resena-nota">
          Este restaurante es tuyo. Las reseñas las escriben los comensales, por
          eso no puedes calificarlo.
        </p>
      ) : usuarioId ? (
        <ResenaForm slug={slug} restaurantId={restaurante.id} mia={mia} />
      ) : (
        // La puerta de entrada, no un muro: dice qué falta y lleva de vuelta
        // aquí mismo en cuanto la persona entra o se registra.
        <div className="resena-puerta">
          <h3>Solo los comensales registrados dejan reseñas</h3>
          <p>
            Pedimos una cuenta para que cada persona califique una vez y su
            reseña tenga un nombre detrás. Es gratis y toma un minuto.
          </p>
          <div className="resena-puerta-botones">
            <Link
              className="btn"
              href={`/registro?next=${encodeURIComponent(volverAqui)}`}
            >
              Crear cuenta
            </Link>
            <Link
              className="btn-texto"
              href={`/entrar?next=${encodeURIComponent(volverAqui)}`}
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      )}

      {deOtros.length ? (
        <ul className="resena-lista">
          {deOtros.map((r) => (
            <li className="resena" key={r.id}>
              <div className="resena-cabeza">
                <span className="resena-autor">{r.author_name}</span>
                <Estrellas valor={r.rating} />
                <span className="resena-fecha">{fecha(r.created_at)}</span>
              </div>
              {r.body ? <p className="resena-texto">{r.body}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
