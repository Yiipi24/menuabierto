import { estiloDeMenu } from "../../../lib/plantillas";
import MenuPintado from "../../menu-render";

// El marcado de la carta vive aparte porque la ficha ya no la pinta: ahora la
// enseña la página /menu, y el día que vuelva a hacer falta en otro lado no hay
// que copiarla.

export default function Carta({ menus, restaurante, destacados = [] }) {
  if (!menus.length) {
    return (
      <p className="ficha-vacio">
        Este restaurante todavía no publica su menú. Vuelve pronto.
      </p>
    );
  }

  return (
    <>
      {/* Con varias cartas, unos enlaces de ancla llevan a cada una. Son anclas
          y no pestañas de JavaScript porque así funcionan con la página a medio
          cargar, se pueden compartir y las indexa el buscador. */}
      {menus.length > 1 ? (
        <nav className="menu-indice">
          {menus.map((m) => (
            <a key={m.id} href={`#menu-${m.id}`}>
              {m.name}
            </a>
          ))}
        </nav>
      ) : null}

      {menus.map((m) => (
        <section className="menu-carta" id={`menu-${m.id}`} key={m.id}>
          {m.kind === "archivo" ? (
            <div className="menu-archivo-publico">
              <h2 className="menu-carta-titulo">{m.name}</h2>
              {m.fileMime === "application/pdf" ? (
                <object
                  className="menu-archivo-vista"
                  data={m.fileUrl}
                  type="application/pdf"
                  aria-label={`${m.name} de ${restaurante.name}`}
                >
                  <p className="ficha-vacio">Tu navegador no muestra el PDF aquí.</p>
                </object>
              ) : (
                <img
                  className="menu-archivo-vista"
                  src={m.fileUrl}
                  alt={`${m.name} de ${restaurante.name}`}
                  loading="lazy"
                />
              )}
              <a className="btn btn-sm" href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                Abrir el menú completo
              </a>
            </div>
          ) : (
            <MenuPintado
              menu={m}
              restaurante={restaurante}
              destacados={destacados}
              estilo={estiloDeMenu(m.template, m.style)}
            />
          )}
        </section>
      ))}
    </>
  );
}
