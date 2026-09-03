import { pesos } from "../../../lib/precios";

// El marcado de la carta vive aparte porque la ficha ya no la pinta: ahora la
// enseña la página /menu, y el día que vuelva a hacer falta en otro lado no hay
// que copiarla.

function Grupos({ menu, Titulo }) {
  return (
    /* La plantilla solo cambia cómo se pinta: el marcado es el mismo y el
       estilo cuelga de esta clase. */
    <div className={`menu-plantilla plantilla-${menu.template}`}>
      {menu.grupos.map((g) => (
        <section className="menu-seccion" key={g.id}>
          <Titulo>{g.name}</Titulo>
          <ul className="menu-lista">
            {g.items.map((p) => (
              <li className={p.is_available ? "menu-item" : "menu-item menu-agotado"} key={p.id}>
                <div>
                  <span className="menu-nombre">{p.name}</span>
                  {p.description ? <span className="menu-desc">{p.description}</span> : null}
                  {!p.is_available ? <span className="menu-etiqueta">Agotado hoy</span> : null}
                </div>
                <span className="menu-precio">{pesos(p.price_cents, p.currency) ?? "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function Carta({ menus, restaurante }) {
  if (!menus.length) {
    return (
      <p className="ficha-vacio">
        Este restaurante todavía no publica su menú. Vuelve pronto.
      </p>
    );
  }

  // Con un solo menú su nombre ya es el h2 de arriba y no se repite como h3,
  // así que las secciones suben un nivel para no dejar el hueco.
  const TituloDeSeccion = menus.length > 1 ? "h4" : "h3";

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
          {menus.length > 1 ? <h3 className="menu-carta-titulo">{m.name}</h3> : null}

          {m.kind === "archivo" ? (
            <div className="menu-archivo-publico">
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
            <Grupos menu={m} Titulo={TituloDeSeccion} />
          )}
        </section>
      ))}
    </>
  );
}
