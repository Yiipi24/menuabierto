import { ICONOS_KPI } from "./tablero-iconos";

const NUMERO = new Intl.NumberFormat("es-MX");

function valorLegible(kpi) {
  if (kpi.valor == null) return "—";
  if (kpi.formato === "calificacion") return kpi.valor.toFixed(1);
  return NUMERO.format(kpi.valor);
}

export function TarjetaKpi({ kpi, comparativa }) {
  const Icono = ICONOS_KPI[kpi.icono] ?? ICONOS_KPI.ojo;
  const sube = kpi.variacion != null && kpi.variacion >= 0;

  return (
    <li className="kpi">
      <div className="kpi-cabeza">
        <span className="kpi-icono">
          <Icono ancho={18} />
        </span>
        <span className="kpi-nombre">{kpi.etiqueta}</span>
      </div>
      <p className="kpi-valor">
        {valorLegible(kpi)}
        {kpi.formato === "calificacion" && kpi.valor != null ? (
          <span className="kpi-estrella" aria-hidden="true">
            ★
          </span>
        ) : null}
      </p>
      {kpi.variacion != null ? (
        <p className={`kpi-var ${sube ? "sube" : "baja"}`}>
          <span aria-hidden="true">{sube ? "↑" : "↓"}</span>{" "}
          {Math.abs(kpi.variacion)}% <em>{comparativa}</em>
        </p>
      ) : (
        <p className="kpi-nota">{kpi.nota}</p>
      )}
    </li>
  );
}

export default function RejillaKpis({ kpis, comparativa }) {
  return (
    <ul className="kpis">
      {kpis.map((kpi) => (
        <TarjetaKpi key={kpi.id} kpi={kpi} comparativa={comparativa} />
      ))}
    </ul>
  );
}

// Mientras se recalcula un periodo se dejan las mismas seis cajas en su
// lugar: si desaparecieran, la página daría un salto y el dueño perdería de
// vista lo que estaba leyendo.
export function KpisCargando() {
  return (
    <ul className="kpis" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="kpi kpi-hueso">
          <div className="hueso hueso-linea corta" />
          <div className="hueso hueso-linea ancha" />
          <div className="hueso hueso-linea corta" />
        </li>
      ))}
    </ul>
  );
}
