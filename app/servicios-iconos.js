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
  // Los cubiertos, que en el resto del sitio ya significan "comer": un plato
  // visto desde arriba son dos círculos y se lee como una diana.
  "comer-aqui": (
    <>
      <path d="M7 3v7a2 2 0 0 0 2 2h0V3M9 12v9M5 3v5" />
      <path d="M17 3c-1.6 1.2-2.4 3-2.4 5.2 0 1.6.8 2.6 2.4 2.8V21" />
    </>
  ),
  // La bolsa de papel con asa, que es como sale la comida por la puerta.
  "para-llevar": (
    <>
      <path d="M5.5 8h13l-1 12.5h-11z" />
      <path d="M9 8V6.2a3 3 0 0 1 6 0V8" />
    </>
  ),
  // La P en su cuadro: es el letrero que la gente busca en la calle, y se
  // reconoce sin leer la etiqueta de al lado.
  estacionamiento: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M9.8 16.5V7.5h3a2.75 2.75 0 0 1 0 5.5h-3" />
    </>
  ),
  // Las ondas de siempre: es el dibujo que ya significa wifi en todas partes.
  wifi: (
    <>
      <path d="M2.5 8.8a14 14 0 0 1 19 0" />
      <path d="M5.8 12.4a9.2 9.2 0 0 1 12.4 0" />
      <path d="M9 15.9a4.4 4.4 0 0 1 6 0" />
      <path d="M12 19.4h.01" />
    </>
  ),
  // La sombrilla sobre la mesa: una terraza dibujada de frente se confunde con
  // un balcón, y con la sombrilla se entiende que ahí se come.
  terraza: (
    <>
      <path d="M3 10.5a9 9 0 0 1 18 0z" />
      <path d="M12 10.5V19a1.8 1.8 0 0 1-3.6 0" />
      <path d="M4.5 21h15" />
    </>
  ),
};

export function IconoServicio({ slug, ancho = 22 }) {
  const dibujo = DIBUJOS[slug];
  if (!dibujo) return null;
  return <Svg ancho={ancho}>{dibujo}</Svg>;
}
