import { IconoTienda, IconoPin } from "./tablero-iconos";

// Piezas que comparten la lista de restaurantes (servidor) y el filtro de
// métricas (cliente): la miniatura, la etiqueta de estado y la línea de
// ubicación. Viven aquí para que las dos las pinten igual.

const ETIQUETA_ESTADO = {
  borrador: "Borrador",
  publicado: "Publicado",
  oculto: "Oculto",
};

export function Estado({ status }) {
  return (
    <span className={`estado estado-${status}`}>
      <span className="estado-punto" aria-hidden="true" />
      {ETIQUETA_ESTADO[status] ?? status}
    </span>
  );
}

export function Avatar({ restaurante, ancho = 24 }) {
  if (restaurante?.foto) {
    return <img className="sel-logo" src={restaurante.foto} alt="" width={56} height={56} />;
  }
  return (
    <span className="sel-logo sel-logo-vacio" aria-hidden="true">
      <IconoTienda ancho={ancho} />
    </span>
  );
}

export function lugar(restaurante) {
  return [restaurante?.neighborhood, restaurante?.city].filter(Boolean).join(" · ");
}

export function Lugar({ restaurante }) {
  const texto = lugar(restaurante);
  if (!texto) return null;
  return (
    <span className="sel-lugar">
      <IconoPin ancho={15} />
      {texto}
    </span>
  );
}
