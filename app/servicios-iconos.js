// Los dibujos de los servicios del local, de trazo y sin librería, como el
// resto de los iconos. Decorativos: al lado siempre va el nombre escrito.
function Svg({ children, ancho = 22 }) {
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
  // La P en su cuadro: es el letrero que la gente busca en la calle, y se
  // reconoce sin leer la etiqueta de al lado.
  estacionamiento: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M9.8 16.5V7.5h3a2.75 2.75 0 0 1 0 5.5h-3" />
    </>
  ),
};

export function IconoServicio({ slug, ancho = 22 }) {
  const dibujo = DIBUJOS[slug];
  if (!dibujo) return null;
  return <Svg ancho={ancho}>{dibujo}</Svg>;
}
