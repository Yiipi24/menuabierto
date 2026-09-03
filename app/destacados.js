// Los destacados de la ficha ("Ahumados al estilo BBQ", "Cocción lenta 14+
// horas") los escribe el dueño y elige su icono de esta lista. El catálogo
// vive aquí, y no junto a los iconos de la ficha, porque lo comparten dos
// lados: el formulario del panel (cliente) y la ficha pública (servidor).
//
// Los dibujos son de trazo, iguales a los del resto de la ficha: son una línea
// cada uno y bajar un paquete de iconos para esto pesaría más que la página.

export const MAX_DESTACADOS = 3;

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

const DIBUJOS = {
  fuego: (
    <path d="M12 3.2c2.6 2.4 4 4.5 4 6.4 0 1.2-.6 2.1-1.7 2.4.5-1.9-.3-3.5-2.3-4.9.2 2.3-.7 3.9-2.6 5.4C8 13.6 7.4 14.7 7.4 16A4.6 4.6 0 0 0 12 20.8 4.6 4.6 0 0 0 16.6 16c0-.9-.2-1.7-.6-2.5" />
  ),
  carne: (
    <>
      <path d="M15.8 4.4c2.8 0 4.9 2.1 4.9 4.7 0 3.4-3 5.3-4.7 7.6-1.3 1.8-2.6 3.3-5.2 3.3-3.4 0-6.5-2.6-6.5-6.2 0-4.6 5.1-9.4 11.5-9.4z" />
      <path d="M13.8 8.6c1.8 0 3 1.2 3 2.7 0 1.7-1.3 2.9-3 2.9s-3-1.2-3-2.9c0-1.5 1.2-2.7 3-2.7z" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  hoja: (
    <>
      <path d="M20 4c-8 0-13 3.4-13 9.2 0 2 .7 3.6 1.8 4.8C11.6 15.4 14.2 13 18 11.2c-3 2.2-5.6 4.6-7.6 8" />
      <path d="M5 20c.4-1.4 1-2.7 1.8-4" />
    </>
  ),
  chef: (
    <>
      <path d="M7 20h10v-3H7z" />
      <path d="M17 17c1.9-1 3-2.8 3-5a4.2 4.2 0 0 0-4.3-4.2A4.4 4.4 0 0 0 12 5.2a4.4 4.4 0 0 0-3.7 2.6A4.2 4.2 0 0 0 4 12c0 2.2 1.1 4 3 5" />
    </>
  ),
  cubiertos: (
    <>
      <path d="M7 3v7a2 2 0 0 0 2 2h0V3M9 12v9M5 3v5" />
      <path d="M17 3c-1.6 1.2-2.4 3-2.4 5.2 0 1.6.8 2.6 2.4 2.8V21" />
    </>
  ),
  taco: (
    <>
      <path d="M3 16a9 9 0 0 1 18 0" />
      <path d="M3 16c0 1.6 1.2 2.6 2.7 2.6H18.3c1.5 0 2.7-1 2.7-2.6" />
      <path d="M8 13.5h.01M12 12h.01M16 13.5h.01" />
    </>
  ),
  pizza: (
    <>
      <path d="M12 3.5 21 19c-2.6 1.3-5.7 2-9 2s-6.4-.7-9-2z" />
      <path d="M10.5 10h.01M13.5 13.5h.01M9 15.5h.01" />
    </>
  ),
  pescado: (
    <>
      <path d="M3.5 12c2.6-3.4 5.6-5.1 9-5.1 3.4 0 6.4 1.7 9 5.1-2.6 3.4-5.6 5.1-9 5.1-3.4 0-6.4-1.7-9-5.1z" />
      <path d="M15.6 12h.01M6 8.6 8.6 12 6 15.4" />
    </>
  ),
  cafe: (
    <>
      <path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M16 9.5h1.8a2.5 2.5 0 0 1 0 5H16M6 5V3.5M10 5V3.5M14 5V3.5" />
    </>
  ),
  bebida: (
    <>
      <path d="M5 4h14l-6 8v7" />
      <path d="M9.5 19h5" />
    </>
  ),
  pan: (
    <>
      <path d="M4.5 9.5c0-2.2 2.4-3.8 5-3.8h5c2.6 0 5 1.6 5 3.8 0 1.3-.9 2.2-2 2.4V17a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 6.5 17v-5.1c-1.1-.2-2-1.1-2-2.4z" />
    </>
  ),
  familia: (
    <>
      <circle cx="8.5" cy="8" r="2.8" />
      <circle cx="16.5" cy="9.5" r="2.2" />
      <path d="M3.5 19c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6M15 14.6c2.6 0 4.5 1.6 4.5 4.4" />
    </>
  ),
  entrega: (
    <>
      <path d="M3 7h9v9H3zM12 10.5h4l3 3V16h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="16.5" cy="18" r="1.8" />
    </>
  ),
  premio: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.6 13.4 7.5 21l4.5-2.4L16.5 21l-1.1-7.6" />
    </>
  ),
  estrella: (
    <path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />
  ),
  corazon: (
    <path d="M12 20s-7.2-4.3-7.2-9.2A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 7.2 2.6c0 4.9-7.2 9.2-7.2 9.2z" />
  ),
  casa: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ),
};

// El orden es el del menú desplegable: primero lo que más se elige.
export const ICONOS_DESTACADO = [
  ["fuego", "Fuego / parrilla"],
  ["carne", "Carne"],
  ["reloj", "Tiempo"],
  ["cubiertos", "Cubiertos"],
  ["chef", "Cocina"],
  ["hoja", "Vegetariano / fresco"],
  ["taco", "Antojitos"],
  ["pizza", "Pizza"],
  ["pescado", "Mariscos"],
  ["pan", "Panadería"],
  ["cafe", "Café"],
  ["bebida", "Bebidas"],
  ["familia", "Familiar"],
  ["entrega", "A domicilio"],
  ["premio", "Premiado"],
  ["estrella", "Destacado"],
  ["corazon", "Favorito"],
  ["casa", "Casero"],
];

export const ICONO_POR_DEFECTO = "estrella";

export function iconoValido(slug) {
  return Object.prototype.hasOwnProperty.call(DIBUJOS, slug);
}

export function IconoDestacado({ slug, ancho = 22 }) {
  const dibujo = DIBUJOS[slug] ?? DIBUJOS[ICONO_POR_DEFECTO];
  return <Svg ancho={ancho}>{dibujo}</Svg>;
}

// Los destacados vienen de jsonb, es decir, de lo que sea que haya en la base.
// Se limpian en un solo lugar para que la ficha pública nunca tenga que
// preguntarse si `text` existe.
export function destacadosDe(valor) {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((d) => ({
      icon: iconoValido(d?.icon) ? d.icon : ICONO_POR_DEFECTO,
      text: String(d?.text ?? "").trim(),
    }))
    .filter((d) => d.text)
    .slice(0, MAX_DESTACADOS);
}
