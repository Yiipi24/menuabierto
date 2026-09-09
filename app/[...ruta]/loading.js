// El esqueleto mientras la ficha o la carta se arman en el servidor: la
// forma de la página —encabezado, galería, franja— sin ningún dato, para que
// no haya un salto de blanco a todo.
export default function Cargando() {
  return (
    <div className="ficha-esqueleto" aria-busy="true" aria-label="Cargando">
      <div className="ficha-esqueleto-nav" />
      <div className="ficha-esqueleto-hero">
        <div className="ficha-esqueleto-foto" />
        <div className="ficha-esqueleto-panel">
          <span className="ficha-esqueleto-linea ancha" />
          <span className="ficha-esqueleto-linea" />
          <span className="ficha-esqueleto-linea corta" />
        </div>
      </div>
      <div className="wrap wrap-ficha ficha-esqueleto-tarjetas">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
