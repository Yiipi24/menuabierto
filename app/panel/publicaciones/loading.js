// El esqueleto imita la forma de la pantalla —título, formulario, dos filas de
// lista— para que al llegar los datos nada salte de sitio.
export default function Cargando() {
  return (
    <div className="panel-wrap">
      <div className="panel-top" />
      <main className="wrap panel-main panel-angosto">
        <div className="hueso hueso-titulo" />
        <div className="hueso hueso-caja" />
        <div className="hueso hueso-fila" />
        <div className="hueso hueso-fila" />
      </main>
    </div>
  );
}
