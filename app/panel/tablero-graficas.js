"use client";

import { useId, useState } from "react";

const NUMERO = new Intl.NumberFormat("es-MX");

// Las gráficas son SVG a mano y no una librería de charts. El proyecto no
// tiene ninguna instalada y son dos dibujos: una línea con área y una dona.
// Un paquete de charts pesa más que toda esta pantalla junta y traería su
// propio estilo, que es justo lo que no queremos.
//
// El viewBox es fijo y el SVG se estira al ancho del contenedor: así el mismo
// dibujo sirve en teléfono y en escritorio sin medir nada en el navegador.
const ANCHO = 640;
const ALTO = 270;
const MARGEN = { arriba: 14, derecha: 30, abajo: 30, izquierda: 46 };

// Redondea hacia arriba de manera que las cuatro marcas del eje caigan en
// cifras limpias (500, 1K, 2.5K) y no en 2,431 o 607.
const PASOS = [1, 2, 2.5, 5, 10];

function techo(valor) {
  if (valor <= 0) return 4;
  const objetivo = valor / 4;
  const orden = 10 ** Math.floor(Math.log10(objetivo));
  const paso = PASOS.find((p) => p * orden >= objetivo) ?? 10;
  return paso * orden * 4;
}

function corto(valor) {
  if (valor >= 1000) {
    const miles = valor / 1000;
    return `${miles % 1 === 0 ? miles : miles.toFixed(1)}K`;
  }
  return String(valor);
}

export function GraficaRendimiento({ titulo, puntos, filtro }) {
  const id = useId();
  const [activo, setActivo] = useState(null);

  const maximo = techo(Math.max(...puntos.map((p) => p.valor), 0));
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const paso = puntos.length > 1 ? anchoUtil / (puntos.length - 1) : 0;

  const x = (i) => MARGEN.izquierda + i * paso;
  const y = (v) => MARGEN.arriba + altoUtil - (v / maximo) * altoUtil;

  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(p.valor)}`).join(" ");
  const area = `${linea} L${x(puntos.length - 1)} ${MARGEN.arriba + altoUtil} L${x(0)} ${
    MARGEN.arriba + altoUtil
  } Z`;

  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maximo * f));

  return (
    <section className="panel-tarjeta grafica">
      <div className="tarjeta-cabeza">
        <h2>{titulo}</h2>
        {filtro}
      </div>

      <div className="grafica-lienzo">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          role="img"
          aria-label={`Visualizaciones: ${puntos
            .map((p) => `${p.etiqueta} ${NUMERO.format(p.valor)}`)
            .join(", ")}`}
        >
          <defs>
            <linearGradient id={`relleno-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {marcas.map((m) => (
            <g key={m}>
              <line
                className="grafica-guia"
                x1={MARGEN.izquierda}
                x2={ANCHO - MARGEN.derecha}
                y1={y(m)}
                y2={y(m)}
              />
              <text className="grafica-eje" x={MARGEN.izquierda - 10} y={y(m) + 4} textAnchor="end">
                {corto(m)}
              </text>
            </g>
          ))}

          <path d={area} fill={`url(#relleno-${id})`} />
          <path className="grafica-linea" d={linea} />

          {puntos.map((p, i) => (
            <circle
              key={p.etiqueta}
              className={`grafica-punto ${activo === i ? "activo" : ""}`}
              cx={x(i)}
              cy={y(p.valor)}
              r={activo === i ? 5.5 : 4}
            />
          ))}

          {puntos.map((p, i) => (
            <text
              key={`e-${p.etiqueta}`}
              className="grafica-eje"
              x={x(i)}
              y={ALTO - 8}
              textAnchor="middle"
            >
              {p.etiqueta}
            </text>
          ))}

          {/* Franjas invisibles: dan un blanco cómodo para el puntero y para
              el teclado sin ensuciar el dibujo. */}
          {puntos.map((p, i) => (
            <rect
              key={`z-${p.etiqueta}`}
              className="grafica-zona"
              x={x(i) - paso / 2}
              y={MARGEN.arriba}
              width={paso || anchoUtil}
              height={altoUtil}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              tabIndex={0}
            >
              <title>{`${p.etiqueta}: ${NUMERO.format(p.valor)} visualizaciones`}</title>
            </rect>
          ))}
        </svg>

        {activo != null ? (
          <div
            className="grafica-globo"
            style={{
              left: `${(x(activo) / ANCHO) * 100}%`,
              top: `${(y(puntos[activo].valor) / ALTO) * 100}%`,
            }}
          >
            <strong>{NUMERO.format(puntos[activo].valor)}</strong>
            <span>{puntos[activo].etiqueta}</span>
          </div>
        ) : null}
      </div>

      <p className="grafica-pie">
        <span className="grafica-muestra" aria-hidden="true" />
        Visualizaciones
      </p>
    </section>
  );
}

export function Lugares({ lugares }) {
  return (
    <section className="panel-tarjeta">
      <div className="tarjeta-cabeza">
        <h2>Lugares desde donde más te han visto</h2>
      </div>
      <div className="lugares">
        <ul className="lugares-lista">
          {lugares.map((l) => (
            <li key={l.nombre} title={`${NUMERO.format(l.valor)} visitas`}>
              <div className="lugar-fila">
                <span className="lugar-nombre">{l.nombre}</span>
                <span className="lugar-pct">{l.porcentaje}%</span>
              </div>
              <div className="lugar-barra">
                <span style={{ width: `${l.porcentaje}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {/* Mapa decorativo. Es una silueta, no datos: el día que haya
            coordenadas reales de origen se cambia este bloque por el mapa sin
            tocar el ranking de al lado. */}
        <div className="lugares-mapa" aria-hidden="true">
          <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice">
            <rect width="120" height="120" rx="10" className="mapa-fondo" />
            <path className="mapa-calle" d="M0 34h120M0 72h120M28 0v120M76 0v120M0 100h120" />
            <path className="mapa-calle suave" d="M0 12l120 40M120 8L0 58" />
            {[
              [30, 40, 9],
              [62, 30, 6],
              [80, 58, 5],
              [46, 78, 7],
              [92, 86, 4],
            ].map(([cx, cy, r]) => (
              <circle key={`${cx}-${cy}`} className="mapa-punto" cx={cx} cy={cy} r={r} />
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

const RADIO = 54;
const GROSOR = 20;
const VUELTA = 2 * Math.PI * RADIO;

export function FuentesDeTrafico({ fuentes, total }) {
  const [activo, setActivo] = useState(null);

  let acumulado = 0;
  const arcos = fuentes.map((f) => {
    const largo = (f.porcentaje / 100) * VUELTA;
    const arco = { ...f, largo, desfase: -acumulado };
    acumulado += largo;
    return arco;
  });

  const resaltado = activo ? fuentes.find((f) => f.id === activo) : null;

  return (
    <section className="panel-tarjeta">
      <div className="tarjeta-cabeza">
        <h2>Fuentes de tráfico</h2>
      </div>
      <div className="fuentes">
        <div className="dona">
          <svg viewBox="0 0 140 140" role="img" aria-label="Reparto de visitas por fuente">
            <g transform="rotate(-90 70 70)">
              <circle className="dona-riel" cx="70" cy="70" r={RADIO} strokeWidth={GROSOR} />
              {arcos.map((a) => (
                <circle
                  key={a.id}
                  cx="70"
                  cy="70"
                  r={RADIO}
                  className={`dona-arco ${activo && activo !== a.id ? "apagado" : ""}`}
                  stroke={a.color}
                  strokeWidth={activo === a.id ? GROSOR + 4 : GROSOR}
                  strokeDasharray={`${a.largo} ${VUELTA - a.largo}`}
                  strokeDashoffset={a.desfase}
                  onMouseEnter={() => setActivo(a.id)}
                  onMouseLeave={() => setActivo(null)}
                >
                  <title>{`${a.etiqueta}: ${a.porcentaje}%`}</title>
                </circle>
              ))}
            </g>
          </svg>
          <div className="dona-centro">
            <strong>{NUMERO.format(resaltado ? resaltado.valor : total)}</strong>
            <span>{resaltado ? resaltado.etiqueta : "Total"}</span>
          </div>
        </div>
        <ul className="fuentes-lista">
          {fuentes.map((f) => (
            <li
              key={f.id}
              onMouseEnter={() => setActivo(f.id)}
              onMouseLeave={() => setActivo(null)}
            >
              <span className="fuente-punto" style={{ background: f.color }} aria-hidden="true" />
              <span className="fuente-nombre">{f.etiqueta}</span>
              <span className="fuente-pct">{f.porcentaje}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
