import { KpisCargando } from "./tablero-kpis";

// El esqueleto imita la forma del tablero (las filas de los restaurantes, la
// barra de "Ver métricas de", seis KPIs y tres cajas de analítica) para que al
// llegar los datos nada salte de sitio.
export default function Cargando() {
  return (
    <div className="panel-wrap">
      <div className="panel-top" />
      <main className="wrap panel-main panel-tablero">
        <div className="hueso hueso-titulo" />
        <div className="hueso hueso-fila-rest" />
        <div className="hueso hueso-fila-rest" />
        <div className="hueso hueso-filtro" />
        <KpisCargando />
        <div className="analitica" aria-hidden="true">
          <div className="panel-tarjeta hueso-caja" />
          <div className="panel-tarjeta hueso-caja" />
          <div className="panel-tarjeta hueso-caja" />
        </div>
      </main>
    </div>
  );
}
