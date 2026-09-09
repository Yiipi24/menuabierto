import { EnlaceMedido } from "../medir";
import { IconoRed } from "../redes-iconos";
import { IconoPago } from "../pagos-iconos";
import { IconoServicio } from "../servicios-iconos";
import { enlaceWhatsapp, mensajeDeContacto, telefonoLegible } from "../../lib/whatsapp";
import { urlDelSitio } from "../../lib/sitio";
import { DIAS, hora } from "./datos";
import {
  IconoChevron,
  IconoEnlaceExterno,
  IconoGlobo,
  IconoReloj,
  IconoTarjeta,
  IconoTelefono,
} from "./iconos";

// La franja informativa: horario, contacto y redes, formas de pago y
// servicios, en cuatro columnas separadas por una línea y no en cuatro
// tarjetas sueltas. Es lo que se pregunta antes de salir de casa, y se lee
// de un vistazo.
//
// Cada columna enseña lo primero y esconde el resto detrás de un "Ver más"
// nativo (`<details>`): funciona sin JavaScript, se abre con el teclado y no
// hay que mantener un estado por bloque.

const VISIBLES = 4;

function Bloque({ id, icono, titulo, children, ocultos = null, cuantosMas = 0 }) {
  return (
    <div className="info-bloque" id={id}>
      <h3 className="info-titulo">
        <span className="info-titulo-icono" aria-hidden="true">
          {icono}
        </span>
        {titulo}
      </h3>
      {children}
      {ocultos && cuantosMas > 0 ? (
        <details className="info-mas">
          <summary>
            <span className="info-mas-abrir">Ver {cuantosMas} más</span>
            <span className="info-mas-cerrar">Ver menos</span>
            <IconoChevron ancho={16} />
          </summary>
          {ocultos}
        </details>
      ) : null}
    </div>
  );
}

function ListaDeDetalles({ elementos, Icono }) {
  return (
    <ul className="info-lista">
      {elementos.map((e) => (
        <li key={e.slug}>
          <span className="info-lista-icono" aria-hidden="true">
            <Icono slug={e.icono} ancho={20} />
          </span>
          <span className="info-lista-texto">
            <strong>{e.nombre}</strong>
            {e.pista ? <span>{e.pista}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Informacion({
  slug,
  r,
  semana,
  hoy,
  abierto,
  redes,
  pagos,
  servicios,
  pedidos,
  descripcion,
  volverA,
}) {
  const hayContacto = r.phone || r.website || pedidos || redes.length;
  if (!semana.length && !hayContacto && !pagos.length && !servicios.length && !descripcion) {
    return null;
  }

  const redesVisibles = redes.slice(0, 3);
  const redesOcultas = redes.slice(3);

  return (
    <section className="info" id="informacion" aria-label="Información del restaurante">
      <div className="wrap wrap-ficha">
        {descripcion ? <p className="info-descripcion">{descripcion}</p> : null}

        <div className="info-franja">
          {semana.length ? (
            <Bloque id="horarios" icono={<IconoReloj ancho={19} />} titulo="Horario">
              <ul className="info-horario">
                {semana.map((d) => (
                  <li
                    key={d.dia}
                    className={[d.dia === hoy ? "es-hoy" : "", d.cerrado ? "es-cerrado" : ""]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="info-horario-dia">
                      {DIAS[d.dia]}
                      {d.dia === hoy ? <em>Hoy</em> : null}
                    </span>
                    <span className="info-horario-horas">
                      {d.cerrado
                        ? "Cerrado"
                        : d.tramos.map((h) => `${hora(h.opens)} – ${hora(h.closes)}`).join(" y ")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={abierto ? "info-estado es-abierto" : "info-estado es-cerrado"}>
                {abierto ? "Abierto ahora" : "Cerrado ahora"}
              </p>
            </Bloque>
          ) : null}

          {hayContacto ? (
            <Bloque
              id="contacto"
              icono={<IconoTelefono ancho={19} />}
              titulo="Contacto y redes"
              cuantosMas={redesOcultas.length}
              ocultos={
                redesOcultas.length ? (
                  <ul className="info-contacto">
                    {redesOcultas.map((red) => (
                      <Red key={red.url} slug={slug} red={red} />
                    ))}
                  </ul>
                ) : null
              }
            >
              <ul className="info-contacto">
                {pedidos ? (
                  <li>
                    <EnlaceMedido
                      slug={slug}
                      evento="whatsapp_click"
                      href={enlaceWhatsapp(
                        pedidos.telefono,
                        mensajeDeContacto(r.name, urlDelSitio(volverA)),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="info-red-logo red-whatsapp" aria-hidden="true">
                        <IconoRed slug="whatsapp" ancho={18} />
                      </span>
                      <span className="info-lista-texto">
                        <strong>Pedidos por WhatsApp</strong>
                        <span>{telefonoLegible(pedidos.telefono)}</span>
                      </span>
                    </EnlaceMedido>
                  </li>
                ) : null}
                {r.phone ? (
                  <li>
                    <EnlaceMedido slug={slug} evento="phone_click" href={`tel:${r.phone}`}>
                      <span className="info-red-logo" aria-hidden="true">
                        <IconoTelefono ancho={18} />
                      </span>
                      <span className="info-lista-texto">
                        <strong>{r.phone}</strong>
                      </span>
                    </EnlaceMedido>
                  </li>
                ) : null}
                {r.website ? (
                  <li>
                    <EnlaceMedido
                      slug={slug}
                      evento="website_click"
                      href={r.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="info-red-logo" aria-hidden="true">
                        <IconoGlobo ancho={18} />
                      </span>
                      <span className="info-lista-texto">
                        <strong>Sitio web</strong>
                      </span>
                      <IconoEnlaceExterno ancho={15} />
                    </EnlaceMedido>
                  </li>
                ) : null}
                {redesVisibles.map((red) => (
                  <Red key={red.url} slug={slug} red={red} />
                ))}
              </ul>
            </Bloque>
          ) : null}

          {pagos.length ? (
            <Bloque
              id="pagos"
              icono={<IconoTarjeta ancho={19} />}
              titulo="Formas de pago"
              cuantosMas={Math.max(0, pagos.length - VISIBLES)}
              ocultos={
                pagos.length > VISIBLES ? (
                  <ListaDeDetalles elementos={pagos.slice(VISIBLES)} Icono={IconoPago} />
                ) : null
              }
            >
              <ListaDeDetalles elementos={pagos.slice(0, VISIBLES)} Icono={IconoPago} />
            </Bloque>
          ) : null}

          {servicios.length ? (
            <Bloque
              id="servicios"
              icono={<IconoServicio slug={servicios[0].icono} ancho={19} />}
              titulo="Servicios"
              cuantosMas={Math.max(0, servicios.length - VISIBLES)}
              ocultos={
                servicios.length > VISIBLES ? (
                  <ListaDeDetalles elementos={servicios.slice(VISIBLES)} Icono={IconoServicio} />
                ) : null
              }
            >
              <ListaDeDetalles elementos={servicios.slice(0, VISIBLES)} Icono={IconoServicio} />
            </Bloque>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Red({ slug, red }) {
  return (
    <li>
      <EnlaceMedido
        slug={slug}
        evento="social_click"
        href={red.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className={`info-red-logo red-${red.slug}`} aria-hidden="true">
          <IconoRed slug={red.slug} ancho={18} />
        </span>
        <span className="info-lista-texto">
          <strong>{red.nombre}</strong>
        </span>
        <IconoEnlaceExterno ancho={15} />
      </EnlaceMedido>
    </li>
  );
}
