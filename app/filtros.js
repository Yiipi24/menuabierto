import Link from "next/link";
import { iconoCocina } from "./cocinas";
import { IconoServicio } from "./servicios-iconos";

// Los filtros se llevan en la URL y no en el estado del navegador: así una
// búsqueda se puede compartir tal cual, el botón "atrás" hace lo esperado y
// esta columna entera se dibuja en el servidor, sin un solo kilobyte de
// JavaScript. Cada casilla es un enlace disfrazado de casilla.
export function hrefCon(params, cambios) {
  const siguiente = new URLSearchParams(params);
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === null || valor === "") siguiente.delete(clave);
    else siguiente.set(clave, valor);
  }
  const cadena = siguiente.toString();
  return cadena ? `/?${cadena}` : "/";
}

// "domicilio,wifi" -> ["domicilio", "wifi"]. Los servicios se acumulan en un
// solo parámetro porque se piden juntos: quien marca dos quiere los dos.
export function listaDe(valor) {
  return typeof valor === "string" && valor
    ? valor.split(",").filter(Boolean)
    : [];
}

function conServicio(actuales, slug) {
  const siguiente = actuales.includes(slug)
    ? actuales.filter((s) => s !== slug)
    : [...actuales, slug];
  return siguiente.join(",");
}

const PRECIOS = ["$", "$$", "$$$", "$$$$"];

const CALIFICACIONES = [
  ["4.5", "4.5 o más"],
  ["4", "4 o más"],
  ["3.5", "3.5 o más"],
];

function Grupo({ titulo, abierto, cuenta, children }) {
  return (
    <details className="filtro-grupo" open={abierto}>
      <summary>
        {titulo}
        {cuenta ? <span className="filtro-cuenta">{cuenta}</span> : null}
        <span className="filtro-flecha" aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}

function Opcion({ href, activa, children }) {
  return (
    <Link
      className={activa ? "filtro-opcion filtro-opcion-on" : "filtro-opcion"}
      href={href}
      // El enlace hace de casilla, así que también tiene que sonar como una:
      // sin esto, un lector de pantalla anuncia "enlace, Tacos" y no dice si
      // el filtro está puesto.
      role="checkbox"
      aria-checked={activa}
    >
      <span className="filtro-casilla" aria-hidden="true">
        ✓
      </span>
      {children}
    </Link>
  );
}

export default function Filtros({
  params,
  categorias,
  servicios,
  zonas,
  cocina,
  serviciosActivos,
  precio,
  calificacion,
  lugar,
  hayFiltros,
}) {
  return (
    <>
      {categorias.length ? (
        <Grupo titulo="Tipo de comida" abierto={Boolean(cocina)} cuenta={cocina ? 1 : 0}>
          <div className="filtro-opciones">
            {categorias.map((c) => (
              <Opcion
                key={c.slug}
                href={hrefCon(params, { cocina: c.slug === cocina ? null : c.slug })}
                activa={c.slug === cocina}
              >
                <span aria-hidden="true">{iconoCocina(c.slug)}</span>
                {c.name}
              </Opcion>
            ))}
          </div>
        </Grupo>
      ) : null}

      <Grupo titulo="Precio" abierto={Boolean(precio)} cuenta={precio ? 1 : 0}>
        <div className="filtro-precio">
          {PRECIOS.map((signo, i) => {
            const nivel = i + 1;
            return (
              <Link
                key={signo}
                className={precio === nivel ? "filtro-precio-on" : undefined}
                href={hrefCon(params, { precio: precio === nivel ? null : String(nivel) })}
                title={`${signo} o menos`}
              >
                {signo}
              </Link>
            );
          })}
        </div>
      </Grupo>

      {/* Las zonas son las de los resultados que hay, no un catálogo de
          municipios: ofrecer "Saltillo" donde no hay ni una ficha es un filtro
          que solo sabe devolver cero. */}
      {zonas.length ? (
        <Grupo titulo="Zona o ciudad" abierto={Boolean(lugar)} cuenta={lugar ? 1 : 0}>
          <div className="filtro-opciones">
            {zonas.map((z) => (
              <Opcion
                key={z}
                href={hrefCon(params, { lugar: z === lugar ? null : z })}
                activa={z === lugar}
              >
                {z}
              </Opcion>
            ))}
          </div>
        </Grupo>
      ) : null}

      {servicios.length ? (
        <Grupo
          titulo="Servicios"
          abierto={serviciosActivos.length > 0}
          cuenta={serviciosActivos.length}
        >
          <div className="filtro-opciones">
            {servicios.map((s) => (
              <Opcion
                key={s.slug}
                href={hrefCon(params, { servicios: conServicio(serviciosActivos, s.slug) })}
                activa={serviciosActivos.includes(s.slug)}
              >
                <span className="filtro-opcion-icono">
                  <IconoServicio slug={s.icon ?? s.slug} ancho={17} />
                </span>
                {s.name}
              </Opcion>
            ))}
          </div>
        </Grupo>
      ) : null}

      <Grupo
        titulo="Calificación mínima"
        abierto={Boolean(calificacion)}
        cuenta={calificacion ? 1 : 0}
      >
        <div className="filtro-opciones">
          {CALIFICACIONES.map(([valor, texto]) => (
            <Opcion
              key={valor}
              href={hrefCon(params, {
                calificacion: calificacion === valor ? null : valor,
              })}
              activa={calificacion === valor}
            >
              <span className="filtro-estrella-marca" aria-hidden="true">
                ★
              </span>
              {texto}
            </Opcion>
          ))}
        </div>
      </Grupo>

      {hayFiltros ? (
        <Link className="filtros-limpiar" href="/">
          <span aria-hidden="true">↺</span> Limpiar filtros
        </Link>
      ) : null}
    </>
  );
}
