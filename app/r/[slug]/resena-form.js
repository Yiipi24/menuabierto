"use client";

import { useActionState, useState } from "react";
import { borrarResena, guardarResena } from "./actions";

const inicial = { status: "idle", message: "" };
const MAX_TEXTO = 1500;

const ETIQUETAS = {
  1: "Mala",
  2: "Regular",
  3: "Buena",
  4: "Muy buena",
  5: "Excelente",
};

export default function ResenaForm({ slug, restaurantId, mia }) {
  const [state, action, pending] = useActionState(guardarResena, inicial);
  const [borrado, borrar, borrando] = useActionState(borrarResena, inicial);

  const [rating, setRating] = useState(mia?.rating ?? 0);
  const [encima, setEncima] = useState(0);
  const [texto, setTexto] = useState(mia?.body ?? "");

  // Al pasar el ratón se pintan las estrellas de la que se está señalando, no
  // las elegidas: sin eso no se ve qué se va a calificar antes de hacer clic.
  const pintadas = encima || rating;
  const aviso = state.status !== "idle" ? state : borrado;

  return (
    <div className="resena-form">
      <h3>{mia ? "Tu reseña" : "Escribe tu reseña"}</h3>

      <form action={action} onMouseLeave={() => setEncima(0)}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="restaurant_id" value={restaurantId} />

        <fieldset className="estrellas-elegir">
          <legend>Tu calificación</legend>
          <div className="estrellas-fila">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className={n <= pintadas ? "estrella estrella-on" : "estrella"}
                onMouseEnter={() => setEncima(n)}
                title={ETIQUETAS[n]}
              >
                {/* El radio es el control de verdad: así funciona con teclado
                    y con lector de pantalla, aunque se vea como una estrella. */}
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  required
                />
                <span aria-hidden="true">★</span>
                <span className="sr-only">
                  {n} {n === 1 ? "estrella" : "estrellas"} · {ETIQUETAS[n]}
                </span>
              </label>
            ))}
            <span className="estrellas-etiqueta">
              {pintadas ? ETIQUETAS[pintadas] : "Toca una estrella"}
            </span>
          </div>
        </fieldset>

        <label className="campo">
          <span>
            Cuéntanos cómo te fue <em>(opcional)</em>
          </span>
          <textarea
            name="body"
            rows={4}
            maxLength={MAX_TEXTO}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Qué pediste, cómo estuvo, si volverías."
          />
          <small className="pista">
            {texto.length}/{MAX_TEXTO}
          </small>
        </label>

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Guardando…" : mia ? "Actualizar reseña" : "Publicar reseña"}
        </button>
      </form>

      {/* Fuera del formulario de arriba: el HTML no permite anidar formularios
          y borrar no debe arrastrar consigo lo que se esté escribiendo. */}
      {mia ? (
        <form action={borrar} className="resena-borrar">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          <button className="btn-texto btn-peligro" type="submit" disabled={borrando}>
            {borrando ? "Borrando…" : "Borrar mi reseña"}
          </button>
        </form>
      ) : null}

      {aviso.status === "error" || aviso.status === "ok" ? (
        <p
          className={aviso.status === "ok" ? "form-msg ok" : "form-msg err"}
          role={aviso.status === "ok" ? "status" : "alert"}
        >
          {aviso.message}
        </p>
      ) : null}
    </div>
  );
}
