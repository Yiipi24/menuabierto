// Iconos del tablero. Van aquí y no en una librería por lo mismo que los de
// la ficha pública: son quince dibujos de una línea y bajar un paquete entero
// pesaría más que la página. El resto del proyecto ya dibuja así.
//
// Todos son decorativos: viven junto al texto que dice lo mismo, así que van
// con aria-hidden.
function Svg({ children, ancho = 20 }) {
  return (
    <svg
      className="icono"
      width={ancho}
      height={ancho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconoOjo(props) {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconoOjoTachado(props) {
  return (
    <Svg {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.3 3.9" />
      <path d="M6.4 7.6A16.6 16.6 0 0 0 2.5 12S6 18 12 18c1.4 0 2.6-.3 3.7-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  );
}

export function IconoQr(props) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1.2" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1.2" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1.2" />
      <path d="M14.5 14.5h2.5v2.5h-2.5zM20.5 14.5h-1M14.5 20.5h2.5M20.5 20.5v-2.5" />
    </Svg>
  );
}

export function IconoTelefono(props) {
  return (
    <Svg {...props}>
      <path d="M7.4 3.6h-2A2.4 2.4 0 0 0 3 6.2c0 8.1 6.7 14.8 14.8 14.8a2.4 2.4 0 0 0 2.6-2.4v-2l-4.2-1.5-1.9 2.2a14.6 14.6 0 0 1-6.1-6.1l2.2-1.9z" />
    </Svg>
  );
}

export function IconoPin(props) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </Svg>
  );
}

export function IconoMarcador(props) {
  return (
    <Svg {...props}>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z" />
    </Svg>
  );
}

export function IconoEstrella(props) {
  return (
    <Svg {...props}>
      <path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </Svg>
  );
}

export function IconoCorona(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 8l3.6 3 4.9-6 4.9 6 3.6-3-1.7 11H5.2z" />
      <path d="M5.2 19h13.6" />
    </Svg>
  );
}

export function IconoMas(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 8.4v7.2M8.4 12h7.2" />
    </Svg>
  );
}

export function IconoTendencia(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 16.5l5.5-5.5 3.5 3.5 6.5-6.5" />
      <path d="M14.5 8h5v5" />
    </Svg>
  );
}

export function IconoReloj(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7v5.2l3.2 2" />
    </Svg>
  );
}

export function IconoCamara(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 8.5h3l1.4-2.2h7.2L16.5 8.5h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </Svg>
  );
}

export function IconoLapiz(props) {
  return (
    <Svg {...props}>
      <path d="M15.6 4.4l4 4L8.9 19.1l-5 1 1-5z" />
      <path d="M13.4 6.6l4 4" />
    </Svg>
  );
}

export function IconoCarta(props) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </Svg>
  );
}

export function IconoBote(props) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.5h15M9.5 6.5V4.4h5v2.1" />
      <path d="M6.4 6.5l.9 13a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.9-13" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </Svg>
  );
}

export function IconoChevron(props) {
  return (
    <Svg {...props}>
      <path d="M6.5 9.5l5.5 5.5 5.5-5.5" />
    </Svg>
  );
}

export function IconoTienda(props) {
  return (
    <Svg {...props}>
      <path d="M4 4.5h16l1.2 4.2a3 3 0 0 1-5.8 1.4 3 3 0 0 1-5.8 0 3 3 0 0 1-5.8-1.4z" />
      <path d="M5 11.5v8h14v-8" />
      <path d="M10 19.5v-4.5h4v4.5" />
    </Svg>
  );
}

export function IconoUsuario(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6" />
    </Svg>
  );
}

export function IconoAbrir(props) {
  return (
    <Svg {...props}>
      <path d="M13.5 4.5h6v6" />
      <path d="M19.5 4.5L11 13" />
      <path d="M18.5 14v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 6 5.5h4.5" />
    </Svg>
  );
}

export function IconoBarras(props) {
  return (
    <Svg {...props}>
      <path d="M5.5 20V11M12 20V4.5M18.5 20v-6" />
    </Svg>
  );
}

export function IconoCalendario(props) {
  return (
    <Svg {...props}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </Svg>
  );
}

export function IconoEquis(props) {
  return (
    <Svg {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

// El mapa de las tarjetas de KPI: el icono va dentro de un círculo naranja
// claro y se elige por nombre para que `KPIS` en lib/metricas.js no tenga que
// importar componentes.
export const ICONOS_KPI = {
  ojo: IconoOjo,
  qr: IconoQr,
  carta: IconoCarta,
  telefono: IconoTelefono,
  pin: IconoPin,
  marcador: IconoMarcador,
  whatsapp: IconoWhatsapp,
  estrella: IconoEstrella,
  gente: IconoGente,
  corazon: IconoCorazon,
  cupon: IconoCupon,
};

// El logo va relleno, como los de `redes-iconos`: es una marca y de trazo no
// se reconoce. Es el único de esta hoja que rompe la regla, y por eso trae su
// propio svg en vez de pasar por `Svg`.
export function IconoWhatsapp({ ancho = 20 }) {
  return (
    <svg
      className="icono"
      width={ancho}
      height={ancho}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-3-.2-.3A8 8 0 1 1 12 20zm4.5-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.2.2 1.8 2.9 4.4 3.9 1.6.6 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2z" />
    </svg>
  );
}

export const ICONOS_IDEA = {
  tendencia: IconoTendencia,
  horario: IconoReloj,
  contenido: IconoCamara,
};

// Los que estrenó la pantalla de menús: el ⋮ de cada fila, el PDF que se baja,
// duplicar, renombrar y la bombilla de los consejos.
export function IconoPuntos(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconoDocumento(props) {
  return (
    <Svg {...props}>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 13h6M9 16.5h4" />
    </Svg>
  );
}

export function IconoCopiar(props) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6.5V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2h1" />
    </Svg>
  );
}

export function IconoTexto(props) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.5V4.5h11v2M10 4.5v15M7.5 19.5h5" />
      <path d="M15.5 12.5v-1h5v1M18 11.5v8M16.5 19.5h3" />
    </Svg>
  );
}

export function IconoFoco(props) {
  return (
    <Svg {...props}>
      <path d="M9.5 17.5h5M10 20.5h4" />
      <path d="M12 3.5a5.5 5.5 0 0 0-3.2 9.9c.5.4.8 1 .8 1.6h4.8c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 3.5z" />
    </Svg>
  );
}

export function IconoCupon(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 8.5V6.8a1.3 1.3 0 0 1 1.3-1.3h14.4a1.3 1.3 0 0 1 1.3 1.3v1.7a2.4 2.4 0 0 0 0 7v1.7a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3v-1.7a2.4 2.4 0 0 0 0-7z" />
      <path d="M9.5 9.5l5 5M9.7 9.7h.01M14.3 14.3h.01" />
    </Svg>
  );
}

export function IconoCorazon(props) {
  return (
    <Svg {...props}>
      <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
    </Svg>
  );
}

export function IconoGente(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.4A5.5 5.5 0 0 1 20.5 19" />
    </Svg>
  );
}
