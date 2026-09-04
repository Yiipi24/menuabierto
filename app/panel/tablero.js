"use client";

import { useMemo, useState } from "react";
import {
  PERIODOS,
  PERIODO_POR_DEFECTO,
  metricasDeRestaurante,
  insightsDeMetricas,
} from "../../lib/metricas";
import RejillaKpis from "./tablero-kpis";
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

export default function Tablero({ restaurantes }) {
  const [id, setId] = useState(restaurantes[0].id);
  const [periodo, setPeriodo] = useState(PERIODO_POR_DEFECTO);

  const elegido = restaurantes.find((r) => r.id === id) ?? restaurantes[0];

  // El cálculo es puro y depende del restaurante y del periodo: con useMemo,
  // mover el ratón por la gráfica no vuelve a generar la serie entera.
  const metricas = useMemo(
    () => metricasDeRestaurante(elegido, periodo),
    [elegido, periodo],
  );
  const ideas = useMemo(
    () => insightsDeMetricas(metricas, elegido),
    [metricas, elegido],
  );

  const filtro = (
    <FiltroDePeriodo valor={periodo} alCambiar={setPeriodo} />
  );

  return (
    <>
      <Selector restaurantes={restaurantes} elegido={elegido} alElegir={setId} />

      {metricas.hayDatos ? (
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
