import { BotonPedirWhatsapp } from "./pedido";
import Seguir from "../_social/seguir";
import ComoLlegar from "./como-llegar";
import { BotonGuardar } from "../medir";
import { IconoDestacado } from "../destacados";
import { IconoPin } from "./iconos";
import { mensajeDeContacto } from "../../lib/whatsapp";
import { urlDelSitio } from "../../lib/sitio";

// El encabezado de la ficha: la fachada a un lado y, al otro, el panel oscuro
// con todo lo que se decide en los primeros tres segundos —qué es, si está
// abierto, cómo pedir y dónde queda.
//
// Es una sola pieza de lado a lado y no una tarjeta flotando sobre la foto: la
// ficha es la página del restaurante dentro de Menú Abierto, y su pared tiene
// que sentirse como la del local. Todo lo que dice sale de la base; lo que el
// dueño no llenó no se pinta.
export default function Hero({
  slug,
  r,
  portada,
  tipo,
  precio,
  abierto,
  apertura,
  hayHorarios,
  destacados,
  direccion,
  pedidos,
  social,
  volverA,
  nota,
}) {
  return (
    <header className={portada ? "hero" : "hero hero-sinfoto"} id="inicio">
      {portada ? (
        <figure className="hero-foto">
          <img src={portada.url} alt={portada.alt ?? `Fachada de ${r.name}`} fetchPriority="high" />
        </figure>
      ) : null}

      <div className="hero-panel">
        <div className="hero-panel-inner">
          <div className="hero-titulo">
            <h1>{r.name}</h1>
            {tipo || precio ? (
              <p className="hero-tipo">{[tipo, precio].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>

          {/* La nota manuscrita: el lema del restaurante, si tiene uno y no es
              lo mismo que ya dice la línea de tipo. */}
          {nota ? (
            <p className="hero-nota" aria-hidden="true">
              {nota}
            </p>
          ) : null}

          <p className="hero-meta">
            {hayHorarios ? (
              <span className={abierto ? "hero-estado es-abierto" : "hero-estado es-cerrado"}>
                {abierto ? "Abierto ahora" : "Cerrado ahora"}
              </span>
            ) : null}
            {apertura ? <span className="hero-apertura">{apertura}</span> : null}
          </p>

          <div className="hero-acciones">
            {/* Seguir pinta dos piezas: el conteo de seguidores y sus botones.
                El conteo se manda a su propio renglón por CSS. */}
            <Seguir
              restauranteId={r.id}
              nombre={r.name}
              seguidores={r.followers_count ?? 0}
              sigo={social.sigo}
              alerta={social.alerta}
              volverA={volverA}
            />
            {pedidos ? (
              <BotonPedirWhatsapp
                telefono={pedidos.telefono}
                mensaje={mensajeDeContacto(r.name, urlDelSitio(volverA))}
                slug={slug}
                clase="btn btn-whatsapp hero-pedir"
              />
            ) : null}
            <BotonGuardar slug={slug} nombre={r.name} />
          </div>
          {pedidos?.nota ? <p className="hero-pedir-nota">{pedidos.nota}</p> : null}

          {destacados.length ? (
            <ul className="hero-destacados">
              {destacados.map((d, i) => (
                <li key={`${d.text}-${i}`}>
                  <IconoDestacado slug={d.icon} ancho={22} />
                  <span>{d.text}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="hero-donde">
            <span className="hero-donde-pin" aria-hidden="true">
              <IconoPin ancho={18} />
            </span>
            <p>{direccion || "Este restaurante todavía no publica su dirección."}</p>
            {direccion ? (
              <ComoLlegar slug={slug} nombre={r.name} direccion={direccion} enlace />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
