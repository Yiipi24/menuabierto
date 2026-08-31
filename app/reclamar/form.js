"use client";

import { useActionState, useState } from "react";
import { buscarFichas, reclamarFicha } from "./actions";

const busquedaInicial = { status: "idle", message: "", resultados: [] };
const reclamoInicial = { status: "idle", message: "" };

export default function ReclamarForm() {
  const [busqueda, buscar, buscando] = useActionState(
    buscarFichas,
    busquedaInicial,
  );
  const [reclamo, reclamar, reclamando] = useActionState(
    reclamarFicha,
    reclamoInicial,
  );
  const [elegido, setElegido] = useState(null);

  if (reclamo.status === "ok") {
    return (
      <div className="aviso">
        <h2>Listo</h2>
        <p>{reclamo.message}</p>
      </div>
    );
  }

  return (
    <>
      <form action={buscar} className="form-alta">
        <label className="campo">
          <span>Nombre del restaurante</span>
          <input
            type="text"
            name="q"
            required
            minLength={3}
            placeholder="Taquería La Esquina"
          />
        </label>
        <button className="btn" type="submit" disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </button>
        {busqueda.status === "error" ? (
          <p className="form-msg err" role="alert">
            {busqueda.message}
          </p>
        ) : null}
      </form>

      {busqueda.status === "ok" && busqueda.resultados.length === 0 ? (
        <div className="vacio">
          <h2>No encontramos ese restaurante</h2>
          <p>
            Puede que todavía no esté en Menú Abierto. En ese caso no hay nada
            que reclamar: publícalo tú desde tu panel y queda a tu nombre.
          </p>
        </div>
      ) : null}

      {busqueda.resultados.length ? (
        <ul className="lista-restaurantes">
          {busqueda.resultados.map((r) => (
            <li key={r.id} className="fila-restaurante">
              <div>
                <h2>{r.name}</h2>
                <p className="fila-meta">{r.lugar}</p>
              </div>
              {r.reclamado ? (
                <span className="estado">Ya tiene dueño</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setElegido(r)}
                >
                  Es mío
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {elegido ? (
        <form action={reclamar} className="form-alta">
          <input type="hidden" name="restaurant_id" value={elegido.id} />

          <h2 className="sub">Reclamar {elegido.name}</h2>

          <label className="campo">
            <span>¿Cómo podemos verificar que es tuyo?</span>
            <textarea
              name="evidence"
              required
              minLength={20}
              rows={4}
              placeholder="Soy el dueño desde 2015. Puedes llamar al 33 1234 5678 en horario de comida, o pasar por el local y preguntar por mí."
            />
          </label>

          <p className="nota-borrador">
            Revisamos cada solicitud a mano. Es lo que impide que un tercero se
            apropie del restaurante de alguien más.
          </p>

          <button className="btn" type="submit" disabled={reclamando}>
            {reclamando ? "Enviando…" : "Enviar solicitud"}
          </button>

          {reclamo.status === "error" ? (
            <p className="form-msg err" role="alert">
              {reclamo.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </>
  );
}
