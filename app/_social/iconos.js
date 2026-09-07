// Los dibujos de la parte social. Van aparte de `_ficha/iconos` porque son de
// otra cosa —el corazón, la campana, el visor de historias— y porque la ficha,
// el feed y el panel los comparten los tres.
//
// Mismo trazo y mismo tamaño de rejilla que el resto del sitio: un icono de
// otra familia se nota enseguida cuando está al lado de los demás.
function Svg({ children, ancho = 24, relleno = false }) {
  return (
    <svg
      className="icono"
      width={ancho}
      height={ancho}
      viewBox="0 0 24 24"
      fill={relleno ? "currentColor" : "none"}
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

// El corazón se rellena cuando está dado: es el mismo dibujo, y cambiar solo el
// relleno hace que el paso de uno a otro se lea como un estado y no como dos
// iconos distintos.
export function IconoCorazon({ relleno = false, ...props }) {
  return (
    <Svg {...props} relleno={relleno}>
      <path d="M12 20.4 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13z" />
    </Svg>
  );
}

export function IconoComentario(props) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.7-.8L3 21l1.9-5.1A8.2 8.2 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z" />
    </Svg>
  );
}

export function IconoCampana({ relleno = false, ...props }) {
  return (
    <Svg {...props} relleno={relleno}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" fill="none" />
    </Svg>
  );
}

export function IconoCampanaTachada(props) {
  return (
    <Svg {...props}>
      <path d="M18 8a6 6 0 0 0-9.3-5" />
      <path d="M6 8c0 7-3 8-3 8h13" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      <path d="M3 3l18 18" />
    </Svg>
  );
}

// Dos siluetas para los seguidores: es el número de personas, no de cuentas.
export function IconoSeguidores(props) {
  return (
    <Svg {...props}>
      <path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" />
      <circle cx="9.5" cy="8" r="3.4" />
      <path d="M21 20v-1.6a3.4 3.4 0 0 0-2.6-3.3M16.4 4.7a3.4 3.4 0 0 1 0 6.6" />
    </Svg>
  );
}

export function IconoSeguir(props) {
  return (
    <Svg {...props}>
      <path d="M15 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H5.4A3.4 3.4 0 0 0 2 18.4V20" />
      <circle cx="8.5" cy="8" r="3.4" />
      <path d="M19 8v6M22 11h-6" />
    </Svg>
  );
}

// El seguido lleva palomita: la diferencia entre "Seguir" y "Siguiendo" no
// puede depender solo del color del botón.
export function IconoSiguiendo(props) {
  return (
    <Svg {...props}>
      <path d="M15 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H5.4A3.4 3.4 0 0 0 2 18.4V20" />
      <circle cx="8.5" cy="8" r="3.4" />
      <path d="M16.5 11.5 19 14l4-4.5" />
    </Svg>
  );
}

export function IconoCerrar(props) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconoPausa(props) {
  return (
    <Svg {...props} relleno>
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" stroke="none" />
    </Svg>
  );
}

export function IconoReproducir(props) {
  return (
    <Svg {...props} relleno>
      <path d="M8 5.5v13l11-6.5z" stroke="none" />
    </Svg>
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

// Los tres puntos del menú de cada pieza.
export function IconoMas(props) {
  return (
    <Svg {...props} relleno>
      <circle cx="5" cy="12" r="1.7" stroke="none" />
      <circle cx="12" cy="12" r="1.7" stroke="none" />
      <circle cx="19" cy="12" r="1.7" stroke="none" />
    </Svg>
  );
}

export function IconoChevronIzq(props) {
  return (
    <Svg {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function IconoChevronDer(props) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function IconoBote(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7l.8 12.1A1.9 1.9 0 0 0 9.2 21h5.6a1.9 1.9 0 0 0 1.9-1.9L17.5 7" />
    </Svg>
  );
}

export function IconoLapiz(props) {
  return (
    <Svg {...props}>
      <path d="M4 20h4L20 8a2.5 2.5 0 0 0-4-4L4 16z" />
      <path d="M14.5 5.5 18.5 9.5" />
    </Svg>
  );
}

export function IconoCamara(props) {
  return (
    <Svg {...props}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-2h7.2l1.2 2h1.7A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </Svg>
  );
}

export function IconoVideo(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" />
      <path d="M14.5 10.5 20.5 7.5v9l-6-3z" />
    </Svg>
  );
}

export function IconoDestello(props) {
  return (
    <Svg {...props}>
      <path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5z" />
    </Svg>
  );
}

// Los dibujos que estrena el formulario de publicar: la foto que se sube, la
// nube de arrastrar y soltar, el avión de enviar, el foco de los consejos.

export function IconoImagen(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M3.5 17.5l4.7-4.6a2 2 0 0 1 2.7-.1l3.4 3 1.7-1.6a2 2 0 0 1 2.7 0l1.8 1.7" />
    </Svg>
  );
}

export function IconoNube(props) {
  return (
    <Svg {...props}>
      <path d="M7 18.5a4.2 4.2 0 0 1-.4-8.4 5.4 5.4 0 0 1 10.4-1.4A3.9 3.9 0 0 1 17.6 18.5" />
      <path d="M12 20.5V11m0 0-2.7 2.7M12 11l2.7 2.7" />
    </Svg>
  );
}

export function IconoGirar(props) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 0 0-13.7-4.6L4 8.5" />
      <path d="M4 4v4.5h4.5" />
      <path d="M4 13a8 8 0 0 0 13.7 4.6L20 15.5" />
      <path d="M20 20v-4.5h-4.5" />
    </Svg>
  );
}

export function IconoAvion(props) {
  return (
    <Svg {...props}>
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3 14.4 21l-3.9-7.5L3 9.6z" />
    </Svg>
  );
}

export function IconoAyuda(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.1-2.4 3.6" />
      <path d="M12 17.2h.01" />
    </Svg>
  );
}

export function IconoFoco(props) {
  return (
    <Svg {...props}>
      <path d="M9.2 17.5a6 6 0 1 1 5.6 0" />
      <path d="M9.5 17.5h5M10 20.5h4" />
    </Svg>
  );
}

export function IconoPalomita(props) {
  return (
    <Svg {...props}>
      <path d="M5 12.8 9.6 17.4 19 8" />
    </Svg>
  );
}

export function IconoEnchufe(props) {
  return (
    <Svg {...props}>
      <path d="M9 3v5M15 3v5" />
      <path d="M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 17v4" />
    </Svg>
  );
}
