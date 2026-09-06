// El icono de cada carta en la lista de la ficha. No hay un campo para
// elegirlo: se adivina del nombre, igual que el icono de un platillo. Es el
// mismo trato de siempre —el dueño no tiene que llenar otra casilla— y
// acertar con "Bebidas" o "Postres" no necesita más que leer el nombre.

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

// La campana de servicio: la carta de siempre, la que no es de nada en
// particular.
export function IconoCharola(props) {
  return (
    <Svg {...props}>
      <path d="M3.5 18.5h17" />
      <path d="M5 15.5a7 7 0 0 1 14 0z" />
      <path d="M12 8.5V6.8" />
      <circle cx="12" cy="5.6" r="1.1" />
    </Svg>
  );
}

export function IconoCompartido(props) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8.5" r="2.8" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16.2 6.2a2.8 2.8 0 0 1 .6 5.5" />
      <path d="M17.4 14.4c1.9.5 3.1 2.2 3.1 4.6" />
    </Svg>
  );
}

export function IconoVaso(props) {
  return (
    <Svg {...props}>
      <path d="M7 8.5h10l-1 10.4a1.6 1.6 0 0 1-1.6 1.4H9.6A1.6 1.6 0 0 1 8 18.9z" />
      <path d="M7.4 12.5h9.2" />
      <path d="M12 8.5V4.2M12 4.2h3.4" />
    </Svg>
  );
}

export function IconoPastel(props) {
  return (
    <Svg {...props}>
      <path d="M4.5 20.5h15V13a2 2 0 0 0-2-2h-11a2 2 0 0 0-2 2z" />
      <path d="M4.5 15.6c1.9 1.3 3.8 1.3 5.6 0s3.8-1.3 5.6 0c1.2.9 2.5 1.2 3.8.9" />
      <path d="M12 11V8.4M12 6.2v.4" />
    </Svg>
  );
}

// El orden importa: "Combos de bebidas" es una carta de bebidas, así que lo
// más específico se pregunta primero.
const PISTAS = [
  { icono: IconoVaso, palabras: ["bebida", "beber", "trago", "coctel", "cóctel", "cerveza", "vino", "cafe", "café", "barra", "drink"] },
  { icono: IconoPastel, palabras: ["postre", "dulce", "pastel", "helado", "reposteria", "repostería"] },
  { icono: IconoCompartido, palabras: ["combo", "charola", "compartir", "familiar", "paquete", "grupo"] },
];

export function IconoDeMenu({ nombre, ancho = 24 }) {
  const texto = String(nombre ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const pista = PISTAS.find((p) =>
    p.palabras.some((palabra) =>
      texto.includes(palabra.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    ),
  );
  const Icono = pista?.icono ?? IconoCharola;
  return <Icono ancho={ancho} />;
}
