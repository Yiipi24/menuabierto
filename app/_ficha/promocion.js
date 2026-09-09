import Link from "next/link";
import Cupones from "./cupones";
import { IconoDeMenu } from "./iconos-menu";
import { IconoCubiertos, IconoFlecha } from "./iconos";

// La franja de promoción y menú: a la izquierda el cupón —lo que caduca— y
// debajo la fila de cartas; a la derecha, lo que el restaurante publicó hoy.
// Las tres piezas son opcionales y la sección se acomoda con las que haya.
export function FilaDeCartas({ cartas, titulo, nota }) {
  if (!cartas.length) {
    return (
      <div className="fx-cartas-fila fx-cartas-fila-vacia" id="menu">
        <span className="fx-cartas-icono" aria-hidden="true">
          <IconoCubiertos ancho={24} />
        </span>
        <div className="fx-cartas-texto">
          <h2>Todavía no hay menú publicado</h2>
          <p>Este restaurante aún no sube su carta. Vuelve pronto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fx-cartas" id="menu">
      <h2 className="fx-cartas-titulo">{titulo}</h2>
      <ul className="fx-cartas-lista">
        {cartas.map((carta) => (
          <li key={carta.id} className="fx-cartas-fila">
            <span className="fx-cartas-icono" aria-hidden="true">
              <IconoDeMenu nombre={carta.nombre} ancho={24} />
            </span>
            <div className="fx-cartas-texto">
              <h3>
                {carta.nombre}
                {carta.principal ? <span className="fx-cartas-principal">Carta principal</span> : null}
                {carta.horario ? (
                  <span className={carta.sirviendo ? "fx-cartas-horario es-ahora" : "fx-cartas-horario"}>
                    {carta.horario}
                    {carta.sirviendo ? " · ahora" : ""}
                  </span>
                ) : null}
              </h3>
              {carta.descripcion ? <p>{carta.descripcion}</p> : null}
            </div>
            <Link className="btn btn-sm fx-cartas-boton" href={carta.href}>
              Ver menú
              <IconoFlecha ancho={17} />
            </Link>
          </li>
        ))}
      </ul>
      {nota}
    </div>
  );
}

export default function Promocion({ slug, cupones, cartas, tituloCartas, nota, novedad }) {
  return (
    <section className="fx-promo" aria-label="Promociones y menú">
      <div className="wrap wrap-ficha fx-promo-inner">
        <div className="fx-promo-principal">
          <Cupones slug={slug} cupones={cupones} />
          <FilaDeCartas cartas={cartas} titulo={tituloCartas} nota={nota} />
        </div>
        {novedad ? <div className="fx-promo-lado">{novedad}</div> : null}
      </div>
    </section>
  );
}
