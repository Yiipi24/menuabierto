import Link from "next/link";
import { ICONOS_IDEA } from "./tablero-iconos";

// Las ideas llegan ya escritas desde lib/metricas.js. Este archivo solo sabe
// pintarlas: cuando las genere el motor de eventos reales, la pantalla no
// cambia. Cada idea es un RestaurantInsight { id, type, title, description,
// severity, action }.
export function TarjetaIdea({ idea }) {
  const Icono = ICONOS_IDEA[idea.type] ?? ICONOS_IDEA.contenido;
  const cuerpo = (
    <>
      <span className="idea-icono">
        <Icono ancho={18} />
      </span>
      <span className="idea-texto">
        <strong>{idea.title}</strong>
        <span>{idea.description}</span>
      </span>
      {idea.action ? (
        <span className="idea-flecha" aria-hidden="true">
          ›
        </span>
      ) : null}
    </>
  );

  const clase = `idea idea-${idea.severity}`;

  return idea.action ? (
    <li>
      <Link className={`${clase} idea-enlace`} href={idea.action.href}>
        {cuerpo}
      </Link>
    </li>
  ) : (
    <li className={clase}>{cuerpo}</li>
  );
}

export default function Ideas({ ideas }) {
  if (!ideas.length) return null;

  return (
    <section className="panel-tarjeta ideas-caja">
      <div className="tarjeta-cabeza">
        <h2>Ideas para hacer crecer tu restaurante</h2>
      </div>
      <ul className="ideas">
        {ideas.map((idea) => (
          <TarjetaIdea key={idea.id} idea={idea} />
        ))}
      </ul>
    </section>
  );
}
