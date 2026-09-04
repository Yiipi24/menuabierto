"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  PERIODOS,
  metricasDesdeRpc,
  insightsDeMetricas,
} from "../../lib/metricas";
import { metricasDe } from "./metricas-actions";
import RejillaKpis, { KpisCargando } from "./tablero-kpis";
import { GraficaRendimiento, Lugares, FuentesDeTrafico } from "./tablero-graficas";
import Ideas from "./tablero-ideas";
import AccionesDelRestaurante from "./tablero-acciones";
import { IconoChevron, IconoTienda } from "./tablero-iconos";

const ETIQUETA_ESTADO = {
  borrador: "Borrador",
  publicado: "Publicado",
  oculto: "Oculto",
};

function Estado({ status }) {
  return (
    <span className={`estado estado-${status}`}>
      <span className="estado-punto" aria-hidden="true" />
      {ETIQUETA_ESTADO[status] ?? status}
    </span>
  );
}

function Avatar({ restaurante }) {
  if (restaurante.foto) {
    return <img className="sel-logo" src={restaurante.foto} alt="" width={56} height={56} />;
  }
  return (
    <span className="sel-logo sel-logo-vacio" aria-hidden="true">
      <IconoTienda ancho={24} />
    </span>
  );
}

function lugar(restaurante) {
  return [restaurante.neighborhood, restaurante.city].filter(Boolean).join(" · ");
}

// Selector del restaurante. Con uno solo es una tarjeta a secas; con varios se
// abre y cambia todo el tablero. Va con <details> para que abra y cierre sin
// que tengamos que reimplementar el foco y el Escape.
function Selector({ restaurantes, elegido, alElegir }) {
  const [abierto, setAbierto] = useState(false);
  const varios = restaurantes.length > 1;

  return (
    <details
      className="sel"
      open={abierto}
      onToggle={(e) => setAbierto(e.currentTarget.open)}
    >
      <summary className={varios ? "" : "sel-fija"}>
        <Avatar restaurante={elegido} />
        <span className="sel-datos">
          <strong>{elegido.name}</strong>
          <span className="sel-lugar">{lugar(elegido)}</span>
        </span>
        <Estado status={elegido.status} />
        {varios ? (
          <span className="sel-chevron">
            <IconoChevron ancho={20} />
          </span>
        ) : null}
      </summary>

      {varios ? (
        <ul className="sel-lista">
          {restaurantes.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={r.id === elegido.id ? "activo" : ""}
                onClick={() => {
                  alElegir(r.id);
                  setAbierto(false);
                }}
              >
                <Avatar restaurante={r} />
                <span className="sel-datos">
                  <strong>{r.name}</strong>
                  <span className="sel-lugar">{lugar(r)}</span>
                </span>
                <Estado status={r.status} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}

function FiltroDePeriodo({ valor, alCambiar }) {
  return (
    <label className="filtro-periodo">
      <span className="sr-only">Periodo</span>
      <select value={valor} onChange={(e) => alCambiar(e.target.value)}>
        {PERIODOS.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.etiqueta}
          </option>
        ))}
      </select>
      <IconoChevron ancho={16} />
    </label>
  );
}

export default function Tablero({
  restaurantes,
  periodoInicial,
  datosIniciales,
  errorInicial,
}) {
  const [id, setId] = useState(restaurantes[0].id);
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [cargando, empezar] = useTransition();

  // Lo que ya se pidió no se vuelve a pedir: cambiar de periodo y volver es
  // instantáneo, y el servidor no recibe la misma consulta dos veces.
  const cache = useRef(
    new Map([[`${restaurantes[0].id}:${periodoInicial}`, datosIniciales]]),
  );
  const [datos, setDatos] = useState(datosIniciales);
  const [error, setError] = useState(Boolean(errorInicial));

  const elegido = restaurantes.find((r) => r.id === id) ?? restaurantes[0];

  const pedir = useCallback(
    (nuevoId, nuevoPeriodo, forzar = false) => {
      const llave = `${nuevoId}:${nuevoPeriodo}`;
      if (!forzar && cache.current.has(llave)) {
        setDatos(cache.current.get(llave));
        setError(false);
        return;
      }
      empezar(async () => {
        const respuesta = await metricasDe(nuevoId, nuevoPeriodo);
        if (respuesta?.error) {
          setError(true);
          return;
        }
        cache.current.set(llave, respuesta.datos);
        setDatos(respuesta.datos);
        setError(false);
      });
    },
    [],
  );

  function elegirRestaurante(nuevoId) {
    setId(nuevoId);
    pedir(nuevoId, periodo);
  }

  function elegirPeriodo(nuevoPeriodo) {
    setPeriodo(nuevoPeriodo);
    pedir(id, nuevoPeriodo);
  }

  const metricas = useMemo(
    () => metricasDesdeRpc(datos, elegido, periodo),
    [datos, elegido, periodo],
  );
  const ideas = useMemo(
    () => insightsDeMetricas(metricas, elegido),
    [metricas, elegido],
  );

  const filtro = <FiltroDePeriodo valor={periodo} alCambiar={elegirPeriodo} />;

  return (
    <>
      <Selector
        restaurantes={restaurantes}
        elegido={elegido}
        alElegir={elegirRestaurante}
      />

      {error ? (
        <section className="panel-tarjeta sin-datos">
          <div className="sin-datos-cabeza">
            <h2>No pudimos cargar tus estadísticas</h2>
            {filtro}
          </div>
          <p>Puede haber sido un tropiezo de la red. Vuelve a intentarlo.</p>
          <button
            className="btn-linea"
            type="button"
            onClick={() => pedir(id, periodo, true)}
          >
            Reintentar
          </button>
        </section>
      ) : cargando ? (
        <>
          <KpisCargando />
          <div className="analitica" aria-hidden="true">
            <div className="panel-tarjeta hueso-caja" />
            <div className="panel-tarjeta hueso-caja" />
            <div className="panel-tarjeta hueso-caja" />
          </div>
        </>
      ) : metricas.hayDatos ? (
        <>
          <RejillaKpis kpis={metricas.kpis} comparativa={metricas.periodo.comparativa} />

          <div className="analitica">
            <GraficaRendimiento
              titulo={metricas.periodo.titulo}
              puntos={metricas.serie.puntos}
              filtro={filtro}
            />
            <Lugares lugares={metricas.lugares} />
            <FuentesDeTrafico fuentes={metricas.fuentes} total={metricas.serie.total} />
          </div>

          <Ideas ideas={ideas} />
        </>
      ) : (
        <section className="panel-tarjeta sin-datos">
          <div className="sin-datos-cabeza">
            <h2>Todavía no hay estadísticas</h2>
            {filtro}
          </div>
          <p>
            Las estadísticas aparecerán cuando tu restaurante comience a recibir
            visitas.{" "}
            {elegido.status === "publicado"
              ? "Comparte tu enlace y tu QR para empezar a medirlas."
              : "Publícalo para que aparezca en las búsquedas de tu zona."}
          </p>
          {elegido.rating_count > 0 ? null : (
            <p className="sin-datos-nota">Tu restaurante todavía no tiene reseñas.</p>
          )}
        </section>
      )}

      <AccionesDelRestaurante restaurante={elegido} />
    </>
  );
}
