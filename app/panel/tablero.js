"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  metricasDesdeRpc,
  insightsDeMetricas,
  sujetoDeSeleccion,
} from "../../lib/metricas";
import { metricasDeSeleccion } from "./metricas-actions";
import RejillaKpis, { KpisCargando } from "./tablero-kpis";
import {
  Cartas,
  Comunidad,
  CuponesMedidos,
  GraficaRendimiento,
  Lugares,
  FuentesDeTrafico,
} from "./tablero-graficas";
import Ideas from "./tablero-ideas";
import FiltroDeMetricas, { FiltroDePeriodo } from "./tablero-filtro";

// La llave del caché y de la petición: los ids ordenados, para que "A y B" y
// "B y A" sean la misma consulta y no se pida dos veces lo mismo.
function llaveDe(ids, periodo) {
  return `${[...ids].sort().join(",")}:${periodo}`;
}

export default function Tablero({
  restaurantes,
  periodoInicial,
  datosIniciales,
  errorInicial,
}) {
  const todos = useMemo(() => restaurantes.map((r) => r.id), [restaurantes]);

  // Se empieza por "Todos": es la respuesta a "¿cómo me está yendo?", que es
  // lo primero que el dueño viene a preguntar. Con un solo restaurante da
  // exactamente lo mismo que "1 restaurante".
  const [modo, setModo] = useState("todos");
  const [idUno, setIdUno] = useState(restaurantes[0].id);
  const [idsVarios, setIdsVarios] = useState(() => todos.slice(0, 2));
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [cargando, empezar] = useTransition();

  const ids = useMemo(
    () => (modo === "uno" ? [idUno] : modo === "varios" ? idsVarios : todos),
    [modo, idUno, idsVarios, todos],
  );

  // Lo que ya se pidió no se vuelve a pedir: cambiar de periodo o de selección
  // y volver es instantáneo, y el servidor no recibe la misma consulta dos
  // veces.
  const cache = useRef(new Map([[llaveDe(todos, periodoInicial), datosIniciales]]));
  const [datos, setDatos] = useState(datosIniciales);
  const [error, setError] = useState(Boolean(errorInicial));

  const seleccionados = useMemo(
    () => restaurantes.filter((r) => ids.includes(r.id)),
    [restaurantes, ids],
  );
  const sujeto = useMemo(() => sujetoDeSeleccion(seleccionados), [seleccionados]);

  const pedir = useCallback(
    (nuevosIds, nuevoPeriodo, forzar = false) => {
      const llave = llaveDe(nuevosIds, nuevoPeriodo);
      if (!forzar && cache.current.has(llave)) {
        setDatos(cache.current.get(llave));
        setError(false);
        return;
      }
      empezar(async () => {
        const respuesta = await metricasDeSeleccion(nuevosIds, nuevoPeriodo);
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

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo);
    const nuevos =
      nuevoModo === "uno" ? [idUno] : nuevoModo === "varios" ? idsVarios : todos;
    pedir(nuevos, periodo);
  }

  function elegirUno(nuevoId) {
    setIdUno(nuevoId);
    pedir([nuevoId], periodo);
  }

  function elegirVarios(nuevosIds) {
    setIdsVarios(nuevosIds);
    pedir(nuevosIds, periodo);
  }

  function elegirPeriodo(nuevoPeriodo) {
    setPeriodo(nuevoPeriodo);
    pedir(ids, nuevoPeriodo);
  }

  const metricas = useMemo(
    () => metricasDesdeRpc(datos, sujeto, periodo),
    [datos, sujeto, periodo],
  );
  const ideas = useMemo(
    () => insightsDeMetricas(metricas, sujeto),
    [metricas, sujeto],
  );

  const filtroPeriodo = (
    <FiltroDePeriodo valor={periodo} alCambiar={elegirPeriodo} />
  );

  const varios = seleccionados.length > 1;

  return (
    <>
      <FiltroDeMetricas
        restaurantes={restaurantes}
        modo={modo}
        alCambiarModo={cambiarModo}
        idUno={idUno}
        alElegirUno={elegirUno}
        idsVarios={idsVarios}
        alCambiarVarios={elegirVarios}
        periodo={periodo}
        alCambiarPeriodo={elegirPeriodo}
      />

      {error ? (
        <section className="panel-tarjeta sin-datos">
          <div className="sin-datos-cabeza">
            <h2>No pudimos cargar tus estadísticas</h2>
            {filtroPeriodo}
          </div>
          <p>Puede haber sido un tropiezo de la red. Vuelve a intentarlo.</p>
          <button
            className="btn-linea"
            type="button"
            onClick={() => pedir(ids, periodo, true)}
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
              filtro={filtroPeriodo}
            />
            <Lugares
              lugares={metricas.lugares}
              ficha={metricas.ficha}
              nombre={sujeto.name}
            />
            <FuentesDeTrafico fuentes={metricas.fuentes} total={metricas.serie.total} />
            {/* El desglose por carta solo tiene sentido con un restaurante:
                al sumar varios, "Comida" de dos locales sería una sola barra. */}
            {varios ? null : (
              <Cartas cartas={metricas.cartas} restauranteId={sujeto.id} />
            )}
            {/* Seguidores y favoritos sí se suman entre sucursales: son
                personas, y quien tiene tres locales quiere saber a cuántas les
                gusta su negocio. Los cupones no, por lo mismo que las cartas. */}
            <Comunidad
              comunidad={metricas.comunidad}
              comparativa={metricas.periodo.comparativa}
              frase={metricas.periodo.frase}
            />
            {varios ? null : (
              <CuponesMedidos cupones={metricas.cupones} restauranteId={sujeto.id} />
            )}
          </div>

          <Ideas ideas={ideas} />
        </>
      ) : (
        <section className="panel-tarjeta sin-datos">
          <div className="sin-datos-cabeza">
            <h2>Todavía no hay estadísticas</h2>
            {filtroPeriodo}
          </div>
          <p>
            {varios
              ? "Las estadísticas aparecerán cuando los restaurantes que elegiste comiencen a recibir visitas."
              : "Las estadísticas aparecerán cuando tu restaurante comience a recibir visitas."}{" "}
            {sujeto.status === "publicado"
              ? "Comparte tu enlace y tu QR para empezar a medirlas."
              : varios
                ? "Publícalos para que aparezcan en las búsquedas de tu zona."
                : "Publícalo para que aparezca en las búsquedas de tu zona."}
          </p>
          {sujeto.rating_count > 0 ? null : (
            <p className="sin-datos-nota">
              {varios
                ? "Todavía no tienen reseñas."
                : "Tu restaurante todavía no tiene reseñas."}
            </p>
          )}
        </section>
      )}
    </>
  );
}
