// Los dibujos de las formas de pago, de trazo y sin librería, igual que el
// resto de los iconos del sitio. Son decorativos: al lado siempre va el nombre
// escrito, así que van con aria-hidden y no anuncian nada de más.
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
  efectivo: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  // El crédito lleva el chip; el débito, la banda. Es la diferencia que la
  // gente reconoce de un vistazo sin leer la etiqueta.
  "tarjeta-credito": (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <rect x="5.5" y="9" width="4" height="3.2" rx="0.8" />
      <path d="M14 15.5h4" />
    </>
  ),
  "tarjeta-debito": (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 15h3.5" />
    </>
  ),
  transferencia: (
    <>
      <path d="M4 8.5h13M13.5 5 17 8.5 13.5 12" />
      <path d="M20 15.5H7M10.5 12 7 15.5 10.5 19" />
    </>
  ),
  "sin-contacto": (
    <>
      <path d="M7.5 12a10 10 0 0 1 0-6" />
      <path d="M11.5 13.5a12 12 0 0 0 0-9" />
      <path d="M15.5 15a14 14 0 0 0 0-12" />
      <path d="M4 19.5c4.5 0 9-1 13-3" />
    </>
  ),
};

// Una forma de pago del catálogo puede llegar antes que su dibujo: se agrega
// con un INSERT y el icono se dibuja después. Mientras tanto se pinta la misma
// paloma que los servicios sin dibujo —"sí, se acepta"— y no un billete
// genérico: un rectángulo con un círculo es casi el dibujo del efectivo, y una
// forma nueva no debería parecerse a otra que ya existe.
const GENERICO = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.4 12.2l2.5 2.5 4.7-5" />
  </>
);

export function IconoPago({ slug, ancho = 22 }) {
  return <Svg ancho={ancho}>{DIBUJOS[slug] ?? GENERICO}</Svg>;
}
