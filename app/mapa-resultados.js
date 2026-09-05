import Link from "next/link";
import { planoDeMapa } from "../lib/mapa";
import { rutaFicha } from "../lib/slug";

// El mapa de la búsqueda: teselas de OpenStreetMap y un pin por restaurante.
// Se arma en el servidor —el plano son veinte líneas de Mercator, no una
// librería— así que la vista de mapa no baja ni un kilobyte de JavaScript de
// más que la de lista.
//
// No se arrastra ni se acerca a propósito. Aquí el mapa contesta "¿por dónde
// caen?", y para moverse por la ciudad está la búsqueda por colonia, que
// además deja una URL que se puede compartir.
export default function MapaResultados({ resultados }) {
  const conCoordenadas = resultados.filter(
    (r) => Number.isFinite(r.lat) && Number.isFinite(r.lng),
  );

  if (!conCoordenadas.length) {
    return (
      <div className="mapa-resultados">
        <div className="mapa-sincoords">
          <h2>Ninguno de estos resultados tiene su punto puesto</h2>
          <p>
            El mapa se llena conforme los restaurantes confirman su dirección.
            Mientras tanto, la lista los trae todos.
          </p>
        </div>
      </div>
    );
  }

  const plano = planoDeMapa(
    conCoordenadas.map((r) => ({ lat: r.lat, lng: r.lng, id: r.id })),
    null,
    // Más columnas que filas porque la caja es ancha, y zoom de calle: una
    // ficha publicada trae su dirección exacta, no una ciudad aproximada.
    { columnas: 4, filas: 3, zoomMax: 16 },
  );

  const porId = new Map(conCoordenadas.map((r) => [r.id, r]));

  return (
    <div className="mapa-resultados">
      <div
        className="mapa-resultados-caja"
        style={{
          aspectRatio: `${plano.columnas} / ${plano.filas}`,
          gridTemplateColumns: `repeat(${plano.columnas}, 1fr)`,
        }}
      >
        {plano.teselas.map((t) => (
          <img key={t.clave} src={t.url} alt="" loading="lazy" width="256" height="256" />
        ))}

        {plano.puntos.map((p, i) => {
          const r = porId.get(p.id);
          return (
            <Link
              key={p.id}
              className="mapa-pin"
              style={{ left: `${p.izquierda}%`, top: `${p.arriba}%` }}
              href={rutaFicha(r.slug)}
              title={r.name}
            >
              <span>{i + 1}</span>
            </Link>
          );
        })}
      </div>

      {/* La misma numeración escrita: en un teléfono no hay dónde posar el
          dedo para leer el nombre de un pin. */}
      <ol className="mapa-lista">
        {plano.puntos.map((p, i) => {
          const r = porId.get(p.id);
          return (
            <li key={p.id}>
              <span className="mapa-lista-numero">{i + 1}</span>
              <Link href={rutaFicha(r.slug)}>{r.name}</Link>
            </li>
          );
        })}
      </ol>

      <div className="mapa-pie">
        <span>
          {conCoordenadas.length === resultados.length
            ? "Todos los resultados están en el mapa"
            : `${conCoordenadas.length} de ${resultados.length} resultados tienen su punto puesto`}
        </span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
      </div>
    </div>
  );
}
