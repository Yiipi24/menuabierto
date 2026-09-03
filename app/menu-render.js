// La carta pintada. Vive aquí, y no dentro de la página pública, porque el
// panel enseña exactamente lo mismo en la vista previa: si el dueño ve una
// cosa mientras elige y otra en su ficha, la vista previa no sirve de nada.
//
// El marcado es el mismo en las cinco plantillas. Lo que cambia es la clase de
// arriba y dos variables de CSS, así que agregar un diseño nuevo es hoja de
// estilo, no un componente más.

import { pesos } from "../lib/precios";
import { clasesDeCarta, variablesDeEstilo } from "../lib/plantillas";
import { iconoDePlatillo } from "../lib/iconos-platillo";
import { IconoPlatillo } from "./menu-iconos";
import { IconoDestacado } from "./destacados";

function Adorno({ lado }) {
  // El adorno del pizarrón: los cubiertos cruzados de un lado y el fuego del
  // otro. Es decoración, así que se esconde de quien lee con lector.
  return (
    <span className={`carta-adorno carta-adorno-${lado}`} aria-hidden="true">
      {lado === "izq" ? (
        <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 8 34 39M13 5 38 36" />
          <path d="M9 8c-3 2-3 6 0 8l4-5zM38 36c2 2 5 2 6-1l-6-3z" />
          <path d="M39 6 22 26M39 6c2 3 1 6-2 8l-3-4z" />
          <path d="M9 39 21 25" />
        </svg>
      ) : (
        <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 8c5 5 7.5 8.8 7.5 12.5 0 2.3-1.2 4-3.3 4.6 1-3.7-.6-6.8-4.4-9.5.4 4.4-1.4 7.5-5 10.4-1.8 1.4-2.9 3.5-2.9 6a9 9 0 0 0 18 0c0-1.7-.4-3.3-1.2-4.8" />
          <path d="M8 41h32" />
        </svg>
      )}
    </span>
  );
}

function Encabezado({ menu, restaurante, destacados, Titulo, conAdornos }) {
  return (
    <header className="carta-cabeza">
      {conAdornos ? <Adorno lado="izq" /> : null}
      <div className="carta-cabeza-texto">
        <Titulo className="carta-titulo">{menu.name}</Titulo>
        {/* El nombre del restaurante va en todas las plantillas: la carta se
            comparte por QR y se abre sola, sin la ficha alrededor. */}
        <p className="carta-restaurante">{restaurante.linea}</p>
        {destacados.length ? (
          <ul className="carta-destacados">
            {destacados.map((d, i) => (
              <li key={`${d.icon}-${i}`}>
                <IconoDestacado slug={d.icon} ancho={17} />
                <span>{d.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {conAdornos ? <Adorno lado="der" /> : null}
    </header>
  );
}

function Platillo({ platillo, conIcono }) {
  const icono = conIcono ? iconoDePlatillo(platillo) : null;

  return (
    <li className={platillo.is_available ? "menu-item" : "menu-item menu-agotado"}>
      {icono ? (
        <span className="menu-icono">
          <IconoPlatillo slug={icono} />
        </span>
      ) : null}

      <div className="menu-item-datos">
        {/* El nombre y el precio van en el mismo renglón y la descripción
            debajo, a todo lo ancho. Con el precio como hermano de todo el
            bloque quedaba a la altura de la última línea de la descripción, no
            a la del platillo. */}
        <span className="menu-fila-titulo">
          <span className="menu-nombre">{platillo.name}</span>
          {/* La guía punteada es un elemento vacío y no un borde del nombre:
              así llega hasta el precio sin subrayar el texto. */}
          <span className="menu-guia" aria-hidden="true" />
          <span className="menu-precio">
            {pesos(platillo.price_cents, platillo.currency) ?? "—"}
          </span>
        </span>
        {platillo.description ? (
          <span className="menu-desc">{platillo.description}</span>
        ) : null}
        {!platillo.is_available ? (
          <span className="menu-etiqueta">Agotado hoy</span>
        ) : null}
      </div>
    </li>
  );
}

export default function MenuPintado({
  menu,
  restaurante,
  destacados = [],
  estilo,
  Titulo = "h2",
  TituloSeccion = "h3",
}) {
  const conAdornos = menu.template === "pizarron";

  return (
    <article className={clasesDeCarta(menu.template, estilo)} style={variablesDeEstilo(estilo)}>
      <div className="carta-tabla">
        <Encabezado
          menu={menu}
          restaurante={restaurante}
          destacados={estilo.destacados ? destacados : []}
          Titulo={Titulo}
          conAdornos={conAdornos}
        />

        <div className="carta-cuerpo">
          {menu.grupos.map((g) => (
            <section className="menu-seccion" key={g.id}>
              <TituloSeccion className="carta-seccion">
                <span>{g.name}</span>
              </TituloSeccion>
              <ul className="menu-lista">
                {g.items.map((p) => (
                  <Platillo key={p.id} platillo={p} conIcono={estilo.iconos} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
