// El esqueleto imita la forma de la pantalla —título, los pasos del formulario
// y la vista previa a la derecha— para que al llegar los datos nada salte de
// sitio.
export default function Cargando() {
  return (
    <div className="panel-wrap">
      <div className="panel-top" />
      <main className="wrap wrap-ancho panel-main">
        <div className="hueso hueso-titulo" />
        <div className="post-layout">
          <div>
            <div className="hueso hueso-caja" />
            <div className="hueso hueso-caja" />
            <div className="hueso hueso-fila" />
          </div>
          <div className="hueso hueso-previa" />
        </div>
      </main>
    </div>
  );
}
