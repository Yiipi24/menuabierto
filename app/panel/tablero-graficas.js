"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { planoDeMapa } from "../../lib/mapa";
import { ICONOS_KPI } from "./tablero-iconos";

const NUMERO = new Intl.NumberFormat("es-MX");

// Las gráficas son SVG a mano y no una librería de charts. El proyecto no
// tiene ninguna instalada y son dos dibujos: una línea con área y una dona.
// Un paquete de charts pesa más que toda esta pantalla junta y traería su
// propio estilo, que es justo lo que no queremos.
//
// El viewBox es fijo y el SVG se estira al ancho del contenedor: así el mismo
// dibujo sirve en teléfono y en escritorio sin medir nada en el navegador.
const ANCHO = 640;
const ALTO = 320;
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

  // Con treinta días no caben treinta etiquetas: se pone una de cada tantas y
  // siempre la última, que es la que dice hasta dónde llega la gráfica.
  const cada = Math.max(1, Math.ceil(puntos.length / 8));
  const conEtiqueta = (i) => i % cada === 0 || i === puntos.length - 1;

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
              key={`p-${i}`}
              className={`grafica-punto ${activo === i ? "activo" : ""}`}
              cx={x(i)}
              cy={y(p.valor)}
              r={activo === i ? 5.5 : 4}
            />
          ))}

          {puntos.map((p, i) =>
            conEtiqueta(i) ? (
              <text
                key={`e-${i}`}
                className="grafica-eje"
                x={x(i)}
                y={ALTO - 8}
                textAnchor="middle"
              >
                {p.etiqueta}
              </text>
            ) : null,
          )}

          {/* Franjas invisibles: dan un blanco cómodo para el puntero y para
              el teclado sin ensuciar el dibujo. */}
          {puntos.map((p, i) => (
            <rect
              key={`z-${i}`}
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

// Mapa de verdad: teselas de OpenStreetMap y un círculo por ciudad, del
// tamaño de su parte del tráfico. No se arrastra ni se acerca a propósito —
// aquí el mapa contesta "¿de dónde vienen?" de un vistazo, y un mapa que se
// mueve invita a jugar con él en vez de leerlo.
function MapaDeLugares({ lugares, ficha, nombre }) {
  const plano = useMemo(() => planoDeMapa(lugares, ficha), [lugares, ficha]);
  if (!plano) return null;

  const mayor = Math.max(...plano.puntos.map((p) => p.valor ?? 0), 1);

  return (
    <figure className="mapa">
      <div
        className="mapa-caja"
        style={{
          aspectRatio: `${plano.columnas} / ${plano.filas}`,
          gridTemplateColumns: `repeat(${plano.columnas}, 1fr)`,
        }}
      >
        {plano.teselas.map((t) => (
          <img key={t.clave} src={t.url} alt="" loading="lazy" width="256" height="256" />
        ))}

        {plano.puntos.map((p) => {
          // El área del círculo crece con las visitas, no el diámetro: al ojo,
          // el doble de área se lee como el doble, y el doble de ancho como
          // cuatro veces.
          const lado = 14 + 22 * Math.sqrt((p.valor ?? 0) / mayor);
          return (
            <span
              key={p.nombre}
              className="mapa-punto"
              style={{
                left: `${p.izquierda}%`,
                top: `${p.arriba}%`,
                width: `${lado}px`,
                height: `${lado}px`,
              }}
              title={`${p.nombre}: ${NUMERO.format(p.valor ?? 0)} visitas`}
            />
          );
        })}

        {plano.ficha ? (
          <span
            className="mapa-local"
            style={{ left: `${plano.ficha.izquierda}%`, top: `${plano.ficha.arriba}%` }}
            title={nombre ? `Aquí está ${nombre}` : "Aquí está tu restaurante"}
          />
        ) : null}
      </div>
      <figcaption className="mapa-credito">
        <span>
          <span className="mapa-muestra local" aria-hidden="true" /> Tu restaurante
          <span className="mapa-muestra visita" aria-hidden="true" /> Desde dónde te ven
        </span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
      </figcaption>
    </figure>
  );
}

export function Lugares({ lugares, ficha, nombre }) {
  const conPunto = lugares.filter((l) => l.lat != null && l.lng != null);

  return (
    <section className="panel-tarjeta">
      <div className="tarjeta-cabeza">
        <h2>Lugares desde donde más te han visto</h2>
      </div>
      {lugares.length === 0 ? (
        <p className="tarjeta-vacia">
          Todavía no sabemos desde dónde te ven. Aparecerá en cuanto tu ficha
          reciba visitas en este periodo.
        </p>
      ) : (
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
          {conPunto.length ? (
            <MapaDeLugares lugares={conPunto} ficha={ficha} nombre={nombre} />
          ) : null}
        </div>
      )}
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
      {fuentes.length === 0 ? (
        <p className="tarjeta-vacia">
          Sin visitas en este periodo todavía no hay fuentes que repartir.
        </p>
      ) : (
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
      )}
    </section>
  );
}

/**
 * Qué carta se está viendo.
 *
 * Solo aparece cuando el restaurante tiene más de una carta: con una sola, sus
 * números son los de la ficha y la tarjeta repetiría lo de arriba. Las que van
 * en cero se quedan en la lista a propósito: son las que hay que mover.
 *
 * Ya no se cuentan escaneos por carta. El QR es uno solo y abre la ficha, así
 * que el escaneo pasa antes de que el comensal elija carta: sale arriba, en
 * las fuentes de tráfico, y desglosarlo aquí sería repartir un dato que no
 * existe.
 */
export function Cartas({ cartas, restauranteId }) {
  if (!cartas.length) return null;

  return (
    <section className="panel-tarjeta">
      <div className="tarjeta-cabeza">
        <h2>Tus cartas</h2>
      </div>
      <ul className="cartas-lista">
        {cartas.map((c) => (
          <li key={c.id}>
            <div className="carta-fila">
              <span className="carta-nombre">{c.nombre}</span>
              <Link className="btn-texto" href={`/panel/${restauranteId}/menus/${c.id}`}>
                Editarla
              </Link>
            </div>
            <div className="lugar-barra">
              <span style={{ width: `${c.porcentaje}%` }} />
            </div>
            <p className="carta-meta">
              {c.vistas === 0
                ? "Nadie la ha abierto en este periodo"
                : `${NUMERO.format(c.vistas)} ${c.vistas === 1 ? "vista" : "vistas"}`}
            </p>
          </li>
        ))}
      </ul>
      <p className="tarjeta-nota">
        Se cuenta lo que pasó en la página de cada carta. Quien abre el menú
        completo desde la ficha cuenta arriba, no aquí.
      </p>
    </section>
  );
}


/**
 * Seguidores y favoritos.
 *
 * No son KPIs y por eso no van en la rejilla de arriba: un KPI cuenta lo que
 * pasó en el periodo, y aquí lo que importa es el total acumulado. Una tarjeta
 * con flecha diría "tus seguidores bajaron 20%" en una semana en la que nadie
 * dejó de seguir, solo entraron menos.
 *
 * Así que el total va en grande y lo que entró en el periodo va debajo, que es
 * lo único que de verdad sube y baja.
 */
export function Comunidad({ comunidad, comparativa, frase }) {
  if (!comunidad?.length) return null;

  return (
    <section className="panel-tarjeta">
      <div className="tarjeta-cabeza">
        <h2>Tu comunidad</h2>
      </div>

      <ul className="comunidad">
        {comunidad.map((c) => {
          const Icono = ICONOS_KPI[c.icono] ?? ICONOS_KPI.ojo;
          const sube = c.variacion != null && c.variacion >= 0;

          return (
            <li key={c.id}>
              <span className="comunidad-icono">
                <Icono ancho={19} />
              </span>
              <div className="comunidad-datos">
                <p className="comunidad-cifra">{NUMERO.format(c.total)}</p>
                <p className="comunidad-nombre">{c.etiqueta}</p>
                <p className="comunidad-nuevos">
                  {c.nuevos > 0
                    ? `+${NUMERO.format(c.nuevos)} ${frase}`
                    : `Sin nuevos ${frase}`}
                  {c.variacion != null ? (
                    <span className={sube ? "comunidad-var sube" : "comunidad-var baja"}>
                      <span aria-hidden="true">{sube ? "↑" : "↓"}</span>{" "}
                      {Math.abs(c.variacion)}% <em>{comparativa}</em>
                    </span>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="tarjeta-nota">
        Los seguidores reciben aviso de tus historias. Los favoritos te guardaron
        en su lista para volver.
      </p>
    </section>
  );
}

/**
 * Los cupones, de punta a punta.
 *
 * Las tres cifras van en ese orden porque así se lee el embudo: cuántos lo
 * vieron, cuántos se llevaron el código y cuántos lo dijeron en la caja. La
 * conversión es la única que contesta si la promoción sirvió, y por eso es la
 * única en color.
 */
export function CuponesMedidos({ cupones, restauranteId }) {
  if (!cupones?.length) return null;

  return (
    <section className="panel-tarjeta">
      <div className="tarjeta-cabeza">
        <h2>Tus cupones</h2>
        <Link className="btn-texto" href={`/panel/${restauranteId}/cupones`}>
          Administrarlos
        </Link>
      </div>

      <ul className="cupones-medidos">
        {cupones.map((c) => (
          <li key={c.id}>
            <div className="carta-fila">
              <span className="codigo-pastilla">{c.codigo}</span>
              <span className="carta-nombre">{c.titulo}</span>
              {c.activo ? null : <span className="estado">Apagado</span>}
            </div>
            <div className="cupon-embudo">
              <span>
                <strong>{NUMERO.format(c.vistas)}</strong> vistas
              </span>
              <span aria-hidden="true">→</span>
              <span>
                <strong>{NUMERO.format(c.copias)}</strong> copiados
              </span>
              <span aria-hidden="true">→</span>
              <span>
                <strong>{NUMERO.format(c.canjes)}</strong> canjes
              </span>
              <span className="cupon-conversion">
                {c.conversion == null ? "—" : `${c.conversion}% de conversión`}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="tarjeta-nota">
        El canje lo registras tú cuando alguien dice el código en la caja. Sin esa
        mitad, la conversión se queda en cero por más que el cupón se vea.
      </p>
    </section>
  );
}
