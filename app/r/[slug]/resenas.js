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

// El reparto se calcula sobre las reseñas que ya están en la página y no con
// otra consulta: son las mismas que se pintan abajo y el número no puede
// contradecir a la lista.
function reparto(resenas) {
  const total = resenas.length;
  return [5, 4, 3, 2, 1].map((estrellas) => {
    const cuantas = resenas.filter((r) => Math.round(r.rating) === estrellas).length;
    return {
      estrellas,
      cuantas,
      porcentaje: total ? Math.round((cuantas / total) * 100) : 0,
    };
  });
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
    <div className="resenas">
      {total ? (
        <div className="resenas-tablero">
          <div className="resenas-resumen">
            <strong>{promedio ?? "—"}</strong>
            <Estrellas valor={promedio ?? 0} />
            <span className="resenas-conteo">
              Basado en {total} {total === 1 ? "reseña" : "reseñas"}
            </span>

            <ul className="resenas-reparto">
              {reparto(resenas).map((fila) => (
                <li key={fila.estrellas}>
                  <span className="resenas-reparto-nivel">
                    {fila.estrellas} <span className="estrella-llena">★</span>
                  </span>
                  <span className="resenas-barra">
                    <span
                      className="resenas-barra-llena"
                      style={{ width: `${fila.porcentaje}%` }}
                    />
                  </span>
                  <span className="resenas-reparto-pct">{fila.porcentaje}%</span>
                </li>
              ))}
            </ul>
          </div>

          {deOtros.length ? (
            <ul className="resena-lista">
              {deOtros.map((r) => (
                <li className="resena" key={r.id}>
                  <div className="resena-cabeza">
                    <span className="resena-autor">{r.author_name}</span>
                    <span className="resena-fecha">{fecha(r.created_at)}</span>
                  </div>
                  <Estrellas valor={r.rating} />
                  {r.body ? <p className="resena-texto">{r.body}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="ficha-vacio resenas-vacio">
          Todavía nadie reseña este lugar. Si ya comiste aquí, tu reseña es la
          primera que van a leer los demás.
        </p>
      )}

      <div className="resenas-escribir">
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
              <Link className="btn" href={`/registro?next=${encodeURIComponent(volverAqui)}`}>
                Crear cuenta
              </Link>
              <Link className="btn-texto" href={`/entrar?next=${encodeURIComponent(volverAqui)}`}>
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
