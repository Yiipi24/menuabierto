"use client";

import { useState } from "react";
import { PERIODOS } from "../../lib/metricas";
import { Avatar, lugar } from "./tablero-piezas";
import {
  IconoBarras,
  IconoCalendario,
  IconoChevron,
  IconoEquis,
} from "./tablero-iconos";

// La barra "Ver métricas de". Decide de qué restaurantes hablan los KPIs y
// las gráficas de abajo: todos juntos, uno solo o los que el dueño elija.
//
// Los tres modos son botones y no un <select> porque son tres y siempre se
// ven: quien tiene cuatro sucursales cambia de vista constantemente y un menú
// desplegable esconde justo lo que más se toca.

export const MODOS = [
  { id: "todos", etiqueta: "Todos" },
  { id: "uno", etiqueta: "1 restaurante" },
  { id: "varios", etiqueta: "Varios" },
];

export function FiltroDePeriodo({ valor, alCambiar, conIcono = false }) {
  return (
    <label className={`filtro-periodo ${conIcono ? "con-calendario" : ""}`}>
      <span className="sr-only">Periodo</span>
      {conIcono ? (
        <span className="filtro-periodo-icono" aria-hidden="true">
          <IconoCalendario ancho={16} />
        </span>
      ) : null}
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

// El desplegable de "1 restaurante": un <select> normal, que en el teléfono da
// el selector nativo y no hay que reinventarle el teclado.
function ElegirUno({ restaurantes, valor, alCambiar }) {
  return (
    <label className="fm-uno">
      <span className="sr-only">Restaurante</span>
      <select value={valor} onChange={(e) => alCambiar(e.target.value)}>
        {restaurantes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {lugar(r) ? ` — ${lugar(r)}` : ""}
          </option>
        ))}
      </select>
      <IconoChevron ancho={16} />
    </label>
  );
}

// El de "Varios": las fichas elegidas se ven como chips que se quitan con su
// ×, y la lista con casillas se abre debajo. Va con <details> para que cierre
// con Escape sin que tengamos que escribirlo.
function ElegirVarios({ restaurantes, ids, alCambiar }) {
  const [abierto, setAbierto] = useState(false);
  const elegidos = restaurantes.filter((r) => ids.includes(r.id));

  function alternar(id) {
    // Nunca se queda vacío: sin ningún restaurante no habría nada que medir y
    // la pantalla se quedaría en blanco sin que el dueño sepa por qué.
    if (ids.includes(id)) {
      if (ids.length === 1) return;
      alCambiar(ids.filter((x) => x !== id));
    } else {
      alCambiar([...ids, id]);
    }
  }

  return (
    <details
      className="fm-varios"
      open={abierto}
      onToggle={(e) => setAbierto(e.currentTarget.open)}
    >
      <summary>
        <span className="fm-chips">
          {elegidos.length === 0 ? (
            <span className="fm-vacio">Elige restaurantes</span>
          ) : (
            elegidos.map((r) => (
              <span key={r.id} className="fm-chip">
                {r.name}
                <button
                  type="button"
                  aria-label={`Quitar ${r.name}`}
                  disabled={elegidos.length === 1}
                  onClick={(e) => {
                    // El chip vive dentro del <summary>: sin esto, quitarlo
                    // abriría o cerraría la lista de paso.
                    e.preventDefault();
                    e.stopPropagation();
                    alternar(r.id);
                  }}
                >
                  <IconoEquis ancho={13} />
                </button>
              </span>
            ))
          )}
        </span>
        <span className="fm-chevron" aria-hidden="true">
          <IconoChevron ancho={18} />
        </span>
      </summary>

      <ul className="fm-opciones">
        {restaurantes.map((r) => (
          <li key={r.id}>
            <label>
              <input
                type="checkbox"
                checked={ids.includes(r.id)}
                onChange={() => alternar(r.id)}
              />
              <Avatar restaurante={r} ancho={18} />
              <span className="fm-opcion-datos">
                <strong>{r.name}</strong>
                {lugar(r) ? <span className="sel-lugar">{lugar(r)}</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function FiltroDeMetricas({
  restaurantes,
  modo,
  alCambiarModo,
  idUno,
  alElegirUno,
  idsVarios,
  alCambiarVarios,
  periodo,
  alCambiarPeriodo,
}) {
  return (
    <section className="panel-tarjeta filtro-metricas">
      <h2 className="fm-titulo">
        <span className="fm-titulo-icono" aria-hidden="true">
          <IconoBarras ancho={18} />
        </span>
        Ver métricas de
      </h2>

      <div className="fm-modos" role="group" aria-label="Qué restaurantes medir">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={modo === m.id ? "activo" : ""}
            aria-pressed={modo === m.id}
            onClick={() => alCambiarModo(m.id)}
          >
            {m.etiqueta}
          </button>
        ))}
      </div>

      <div className="fm-detalle">
        {modo === "uno" ? (
          <ElegirUno restaurantes={restaurantes} valor={idUno} alCambiar={alElegirUno} />
        ) : null}
        {modo === "varios" ? (
          <ElegirVarios
            restaurantes={restaurantes}
            ids={idsVarios}
            alCambiar={alCambiarVarios}
          />
        ) : null}
        {modo === "todos" ? (
          <p className="fm-nota">
            Datos de {restaurantes.length}{" "}
            {restaurantes.length === 1 ? "restaurante" : "restaurantes"}, sumados.
          </p>
        ) : null}
      </div>

      <FiltroDePeriodo valor={periodo} alCambiar={alCambiarPeriodo} conIcono />
    </section>
  );
}
