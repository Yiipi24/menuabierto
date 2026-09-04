// Un dibujo por insignia, de trazo, como el resto de los iconos del sitio. Se
// reconocen entre sí de un vistazo (chispa, tenedor, brújula, copa, pluma,
// megáfono, corona) para que la fila de siete no parezca la misma medalla
// repetida.
//
// Son decorativos: junto a cada uno va el nombre escrito.
function Svg({ children, ancho = 26 }) {
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

const DIBUJOS = {
  primera: (
    <>
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
      <path d="M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  catador: (
    <>
      <path d="M7 3v6a2 2 0 0 0 2 2M9 11v10M5 3v6M9 3v6" />
      <path d="M16.5 3.5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" />
    </>
  ),
  explorador: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9l-2 4.6-4 1.4 2-4.6z" />
    </>
  ),
  sibarita: (
    <>
      <path d="M6 4h12v3a6 6 0 0 1-12 0z" />
      <path d="M6 5H4.2A2.2 2.2 0 0 0 4.2 9.4H6M18 5h1.8a2.2 2.2 0 0 1 0 4.4H18" />
      <path d="M12 13v5M8.5 20.5h7" />
    </>
  ),
  critico: (
    <>
      <path d="M4 20l1-4 9.6-9.6a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L9 20z" />
      <path d="M13.5 7.5l3 3" />
    </>
  ),
  embajador: (
    <>
      <path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l6 4.5V6L8 10.5H5.5A1.5 1.5 0 0 0 4 12" />
      <path d="M17.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  leyenda: (
    <>
      <path d="M3.5 7l3.8 3.2L12 4l4.7 6.2L20.5 7l-1.6 11H5.1z" />
      <path d="M5.1 20.5h13.8" />
    </>
  ),
};

export function IconoInsignia({ slug, ancho = 26 }) {
  const dibujo = DIBUJOS[slug];
  if (!dibujo) return null;
  return <Svg ancho={ancho}>{dibujo}</Svg>;
}
