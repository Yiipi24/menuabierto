"use client";

import { useState } from "react";
import RespuestaDueno from "./respuesta-dueno";
import Reportar from "./reportar";
import { insigniaActual } from "../../lib/insignias";
import { ordenarResenas, resumenVerificadas } from "../../lib/pases";
import { IconoInsignia } from "../insignias-iconos";

const FECHA = new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "long", day: "numeric" });

function fecha(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : FECHA.format(d);
}

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

function Insignia({ resenas }) {
  const insignia = insigniaActual(resenas);
  if (!insignia) return null;
  return (
    <span className="resena-insignia" title={`${insignia.nombre} · ${insignia.lema}`}>
      <IconoInsignia slug={insignia.slug} ancho={15} />
      {insignia.nombre}
    </span>
  );
}

// La marca de "estuve ahí". Es lo que Google no puede copiar sin pegar un QR
// en cada mesa, y por eso va junto al nombre y no en letra chica.
export function MarcaVerificada() {
  return (
    <span className="resena-verificada" title="Esta persona escaneó el QR del local antes de reseñar">
      <span aria-hidden="true">✓</span> Verificada
    </span>
  );
}

/**
 * La lista de reseñas con sus controles: ver solo las verificadas y ponerlas
 * primero. Es un componente de cliente porque el filtro es cosa de quien lee,
 * y la ficha —guardada en caché— es la misma para todos.
 */
export default function ListaResenas({ slug, restaurante, resenas, usuarioId, esDueno, volverA }) {
  const [soloVerificadas, setSoloVerificadas] = useState(false);
  const [verificadasPrimero, setVerificadasPrimero] = useState(false);
  const resumen = resumenVerificadas(resenas);
  const lista = ordenarResenas(resenas, { soloVerificadas, verificadasPrimero });

  return (
    <>
      {resumen.verificadas ? (
        <div className="resenas-verificadas-controles">
          <p className="resenas-verificadas-resumen">
            <MarcaVerificada /> {resumen.verificadas} de {resumen.total}{" "}
            {resumen.verificadas === 1 ? "escaneó" : "escanearon"} el QR del local
            {resumen.promedioVerificadas != null ? (
              <>
                {" "}
                · promedio de las verificadas <b>{resumen.promedioVerificadas}</b>
              </>
            ) : null}
          </p>
          <div className="resenas-verificadas-botones">
            <label className="resenas-filtro">
              <input
                type="checkbox"
                checked={soloVerificadas}
                onChange={(e) => setSoloVerificadas(e.target.checked)}
              />
              Solo verificadas
            </label>
            <label className="resenas-filtro">
              <input
                type="checkbox"
                checked={verificadasPrimero}
                onChange={(e) => setVerificadasPrimero(e.target.checked)}
                disabled={soloVerificadas}
              />
              Verificadas primero
            </label>
          </div>
        </div>
      ) : null}

      {lista.length ? (
        <ul className="resena-lista">
          {lista.map((r) => (
            <li className={r.verified_at ? "resena es-verificada" : "resena"} key={r.id}>
              <div className="resena-cabeza">
                <span className="resena-autor">
                  {r.author_name}
                  <Insignia resenas={r.author_reviews} />
                  {r.verified_at ? <MarcaVerificada /> : null}
                </span>
                <span className="resena-fecha">{fecha(r.created_at)}</span>
              </div>
              <Estrellas valor={r.rating} />
              {r.body ? <p className="resena-texto">{r.body}</p> : null}

              {r.owner_reply ? (
                <div className="resena-respuesta">
                  <span className="resena-respuesta-quien">
                    Respuesta de {restaurante.name}
                    {r.owner_reply_at ? <span className="resena-fecha"> · {fecha(r.owner_reply_at)}</span> : null}
                  </span>
                  <p className="resena-texto">{r.owner_reply}</p>
                </div>
              ) : null}

              {esDueno ? (
                <>
                  {r.report_pending ? (
                    <p className="resena-en-revision">Reportada: en revisión. Sigue visible hasta que se resuelva.</p>
                  ) : null}
                  <RespuestaDueno slug={slug} reviewId={r.id} respuesta={r.owner_reply} />
                  {r.report_pending ? null : (
                    <Reportar slug={slug} reviewId={r.id} usuarioId={usuarioId} volverA={volverA} />
                  )}
                </>
              ) : (
                <Reportar slug={slug} reviewId={r.id} usuarioId={usuarioId} volverA={volverA} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ficha-vacio resenas-vacio">No hay reseñas verificadas todavía.</p>
      )}
    </>
  );
}
