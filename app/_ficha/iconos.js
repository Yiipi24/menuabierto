// Iconos de trazo, sin librería: son ocho dibujos de una línea cada uno y
// bajar un paquete entero para eso pesaría más que la página.
//
// Todos son decorativos y viven junto a un texto que dice lo mismo, así que
// van con aria-hidden y no anuncian nada de más al lector de pantalla.
function Svg({ children, ancho = 24 }) {
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

export function IconoPin(props) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </Svg>
  );
}

export function IconoCubiertos(props) {
  return (
    <Svg {...props}>
      <path d="M7 3v7a2 2 0 0 0 2 2h0V3M9 12v9M5 3v5" />
      <path d="M17 3c-1.6 1.2-2.4 3-2.4 5.2 0 1.6.8 2.6 2.4 2.8V21" />
    </Svg>
  );
}

export function IconoReloj(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function IconoTelefono(props) {
  return (
    <Svg {...props}>
      <path d="M6.5 3.5h3l1.5 3.7-2 1.4a11.5 11.5 0 0 0 5.4 5.4l1.4-2 3.7 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />
    </Svg>
  );
}

export function IconoEscudo(props) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 2.6v5.6c0 4.4-3 7.6-7 9.2-4-1.6-7-4.8-7-9.2V5.6z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function IconoTarjeta(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M6.5 14.5h3" />
    </Svg>
  );
}

export function IconoFlecha(props) {
  return (
    <Svg {...props}>
      <path d="M5 12h13M13 6.5l5.5 5.5L13 17.5" />
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
      <path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />
    </Svg>
  );
}

export function IconoCompartir(props) {
  return (
    <Svg {...props}>
      <path d="M12 15V4M8.5 7.5L12 4l3.5 3.5" />
      <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
    </Svg>
  );
}

export function IconoGlobo(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9s1.2-6.5 3.6-9z" />
    </Svg>
  );
}

export function IconoFlechaAtras(props) {
  return (
    <Svg {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  );
}

export function IconoEnlaceExterno(props) {
  return (
    <Svg {...props}>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
    </Svg>
  );
}

export function IconoDescargar(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
    </Svg>
  );
}
