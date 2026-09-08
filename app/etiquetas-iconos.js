// Los dibujos de las etiquetas de platillo, de trazo y sin librería, como el
// resto de los iconos del sitio. Decorativos: al lado siempre va el nombre
// escrito, aquí y en el panel.
function Svg({ children, ancho = 16 }) {
  return (
    <svg
      className="icono"
      width={ancho}
      height={ancho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

// La diagonal de "sin". Se dibuja igual en las cuatro etiquetas que niegan algo
// —sin gluten, sin lactosa, sin azúcar— para que se lean como familia y no haya
// que descifrar cada una por su cuenta.
const TACHA = <path d="M4.6 19.4 19.4 4.6" />;

const DIBUJOS = {
  // Una hoja con su nervadura: es lo que ya significa "de plantas" en
  // cualquier carta del mundo.
  hoja: (
    <>
      <path d="M20 4c0 9-5.2 13.4-11.4 13.4-1.3 0-2.6-.3-3.6-.9C6.4 8.8 12.2 4.6 20 4z" />
      <path d="M5 20c1.6-4.2 4.4-7.4 8.4-9.6" />
    </>
  ),
  // El brote de dos hojas saliendo del tallo. Vegano es "más vegetal" que
  // vegetariano y el dibujo lo dice: la planta entera, no una hoja cortada.
  brote: (
    <>
      <path d="M12 21v-8.4" />
      <path d="M12 12.6c0-3 2.3-5.4 5.6-5.6-.2 3.2-2.5 5.6-5.6 5.6z" />
      <path d="M12 14.6c-2.7 0-4.8-2.1-5-4.9 2.9.2 5 2.2 5 4.9z" />
    </>
  ),
  // La espiga tachada. La espiga sola es el dibujo del gluten; con la diagonal
  // encima es su ausencia, que es justo lo que se busca en una carta.
  "sin-gluten": (
    <>
      <path d="M12 20.5V9" />
      <path d="M12 9c0-2 1.3-3.6 3.4-4.2C15.4 6.9 14.1 8.5 12 9z" />
      <path d="M12 9c0-2-1.3-3.6-3.4-4.2C8.6 6.9 9.9 8.5 12 9z" />
      <path d="M12 14.4c0-2 1.3-3.6 3.4-4.2 0 2.1-1.3 3.7-3.4 4.2z" />
      <path d="M12 14.4c0-2-1.3-3.6-3.4-4.2 0 2.1 1.3 3.7 3.4 4.2z" />
      {TACHA}
    </>
  ),
  // El cartón de leche tachado.
  "sin-lactosa": (
    <>
      <path d="M8 20.5V9.5l2-4h4l2 4v11z" />
      <path d="M10 5.5h4" />
      {TACHA}
    </>
  ),
  // Los dos terrones de azúcar, tachados.
  "sin-azucar": (
    <>
      <rect x="3.5" y="12" width="8" height="7" rx="1.4" />
      <rect x="12.5" y="5" width="8" height="7" rx="1.4" />
      {TACHA}
    </>
  ),
  // El aguacate: media fruta con su hueso. Es la comida que la dieta keto puso
  // en todas partes, y se reconoce a 16 píxeles.
  keto: (
    <>
      <path d="M12 21c-3.6 0-6.2-2.8-6.2-6.4 0-3.4 2.3-4.8 3.4-7.4C10.1 4.9 10.8 3 12 3s1.9 1.9 2.8 4.2c1.1 2.6 3.4 4 3.4 7.4 0 3.6-2.6 6.4-6.2 6.4z" />
      <ellipse cx="12" cy="14.8" rx="2.4" ry="2.9" />
    </>
  ),
  // La media luna con la estrella: el símbolo con el que se señala lo halal en
  // los locales que lo son.
  halal: (
    <>
      <path d="M16.6 17.4A6.6 6.6 0 1 1 15 4.9a5.3 5.3 0 0 0 1.6 12.5z" />
      <path d="m18.6 6.4.9 1.9 2.1.3-1.5 1.5.4 2-1.9-1-1.9 1 .4-2L15.6 8.6l2.1-.3z" />
    </>
  ),
  // La estrella de seis puntas.
  kosher: (
    <>
      <path d="M12 3.2 20 17H4z" />
      <path d="M12 20.8 4 7h16z" />
    </>
  ),
  // El chile con su rabito. Un chile es lo que se dibuja para decir "pica" en
  // cualquier carta mexicana.
  chile: (
    <>
      <path d="M14.6 8.2c2.6 1 3.7 3.6 3 6.2-.9 3.3-4 5.4-7.5 5.4-3.1 0-5.4-1.4-6.6-3.4 3.4.5 6.1-.9 7.6-3 1-1.5 1.6-3.4 3.5-5.2z" />
      <path d="M14.6 8.2c-.4-1.6.1-3 1.4-3.9M16 4.3c1.2-.4 2.3 0 3 .9" />
    </>
  ),
  // Dos chiles, que es como se marca el escalón de arriba: no hay que aprender
  // un dibujo nuevo, solo contar.
  "chile-doble": (
    <>
      <path d="M11.4 9.6c1.9.8 2.7 2.7 2.2 4.6-.7 2.4-3 4-5.6 4-2.3 0-4-1-4.9-2.5 2.5.4 4.5-.7 5.6-2.2.8-1.1 1.3-2.5 2.7-3.9z" />
      <path d="M11.4 9.6c-.3-1.2 0-2.2 1-2.9" />
      <path d="M19.4 6.6c1.9.8 2.7 2.7 2.2 4.6-.3 1-.9 1.9-1.7 2.6" />
      <path d="M19.4 6.6c-.3-1.2 0-2.2 1-2.9" />
    </>
  ),
  // El pescado del sushi sobre su bola de arroz: crudo es, casi siempre, esto.
  crudo: (
    <>
      <rect x="3.5" y="12.4" width="17" height="6.2" rx="3.1" />
      <path d="M3.9 12.4c1.4-2.4 4.3-3.9 8.1-3.9s6.7 1.5 8.1 3.9" />
      <path d="M8 10.2c.9 1 1.5 2 1.8 3M13 8.9c.7 1.1 1.1 2.2 1.3 3.5" />
    </>
  ),
  // Dos personas y el plato entre las dos.
  compartir: (
    <>
      <circle cx="6.6" cy="6.6" r="2.6" />
      <circle cx="17.4" cy="6.6" r="2.6" />
      <path d="M3 20.5c.3-2.4 1.8-3.9 3.6-3.9s3.3 1.5 3.6 3.9" />
      <path d="M13.8 20.5c.3-2.4 1.8-3.9 3.6-3.9s3.3 1.5 3.6 3.9" />
      <path d="M9.4 12.6h5.2" />
    </>
  ),
  // La estrella de siempre: lo que la casa presume.
  estrella: (
    <path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.8l5.9-.8z" />
  ),
  // El pulgar arriba, que es "esto es lo que pide la gente" sin tener que
  // escribirlo.
  "mas-pedido": (
    <>
      <path d="M7.5 20.5V10.6l4-6.6c1.4.2 2.2 1.2 2.2 2.7 0 1-.3 2-.8 3h4.5c1.3 0 2.2 1 2 2.3l-1 6c-.2 1.4-1.2 2.5-2.6 2.5z" />
      <rect x="3" y="10.6" width="4.5" height="9.9" rx="1.3" />
    </>
  ),
  // El destello de "recién salido": tres rayos, no una estrella, para no
  // confundirlo con la especialidad de la casa.
  nuevo: (
    <>
      <path d="m9 3.6 1.7 3.6 3.6 1.7-3.6 1.7L9 14.2l-1.7-3.6L3.7 8.9l3.6-1.7z" />
      <path d="m17.4 13.4.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" />
    </>
  ),
  // La espiga, sin tachar: aquí sí lo lleva.
  trigo: (
    <>
      <path d="M12 20.5V9" />
      <path d="M12 9c0-2 1.3-3.6 3.4-4.2C15.4 6.9 14.1 8.5 12 9z" />
      <path d="M12 9c0-2-1.3-3.6-3.4-4.2C8.6 6.9 9.9 8.5 12 9z" />
      <path d="M12 14.4c0-2 1.3-3.6 3.4-4.2 0 2.1-1.3 3.7-3.4 4.2z" />
      <path d="M12 14.4c0-2-1.3-3.6-3.4-4.2 0 2.1 1.3 3.7 3.4 4.2z" />
    </>
  ),
  // El cartón de leche, sin tachar.
  leche: (
    <>
      <path d="M8 20.5V9.5l2-4h4l2 4v11z" />
      <path d="M10 5.5h4M8 9.5h8" />
    </>
  ),
  // El huevo estrellado visto desde arriba: la clara con su yema. Un óvalo
  // solo se confunde con una papa.
  huevo: (
    <>
      <path d="M12 3.5c4.2 0 7.5 3.9 7.5 8.6 0 4.7-3.1 8.4-7.5 8.4S4.5 16.8 4.5 12.1C4.5 7.4 7.8 3.5 12 3.5z" />
      <circle cx="12" cy="12" r="3.1" />
    </>
  ),
  pescado: (
    <>
      <path d="M3 12c2.6-3.4 5.9-5.1 9.8-5.1 3.4 0 6.1 1.7 8.2 5.1-2.1 3.4-4.8 5.1-8.2 5.1C8.9 17.1 5.6 15.4 3 12z" />
      <path d="M15.6 12h.01" />
      <path d="M3 12 6.4 8.6M3 12l3.4 3.4" />
    </>
  ),
  // El camarón enrollado.
  camaron: (
    <>
      <path d="M19 6.8c-4.6 0-7.4 1.8-7.4 4.6 0 2 1.6 3 3.1 3 1.4 0 2.3-.8 2.3-1.8 0-.9-.7-1.4-1.4-1.4" />
      <path d="M11.6 11.4c-2 3.6-4.4 5.6-7.1 6 1-3.2 1.4-6 1.2-8.4" />
      <path d="M19 6.8c1 .6 1.6 1.5 1.8 2.7M14.4 17.6c.7 1 .8 2 .3 3" />
    </>
  ),
  // La concha de abanico: la almeja, el ostión y el pulpo caben debajo del
  // mismo dibujo, y ese es el que se reconoce.
  concha: (
    <>
      <path d="M12 20.4c-4.6 0-8.4-3.6-8.4-8.1C3.6 7.7 7.4 4 12 4s8.4 3.7 8.4 8.3c0 4.5-3.8 8.1-8.4 8.1z" />
      <path d="M12 20.4V4M7 5.6l2.6 14.2M17 5.6l-2.6 14.2" />
    </>
  ),
  // La nuez con su hendidura.
  nuez: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 3.6v16.8" />
      <path d="M8.6 5c1.6 2.2 2.4 4.6 2.4 7s-.8 4.8-2.4 7M15.4 5c-1.6 2.2-2.4 4.6-2.4 7s.8 4.8 2.4 7" />
    </>
  ),
  // El cacahuate en su cáscara: dos bultos y la cintura, que es su silueta.
  cacahuate: (
    <>
      <path d="M15.6 11.2c1.5 1 2.4 2.4 2.4 4.1 0 2.9-2.3 5.1-5.4 5.1s-5.4-2.2-5.4-5.1c0-1.7.9-3.1 2.4-4.1 1-.7 1.4-1.5 1.4-2.6 0-2.8 1-5.1 1.6-5.1s1.6 2.3 1.6 5.1c0 1.1.4 1.9 1.4 2.6z" />
      <path d="M9.6 11.4c1.6.7 3.2.7 4.8 0" />
    </>
  ),
  // Las tres semillas en su vaina.
  soya: (
    <>
      <path d="M5.4 6.6c4.6-2 9.6-1 12.4 2.2 2 2.3 2.2 5.4.6 7.6-2.6 3.6-8.6 3.6-11.6-.4" />
      <circle cx="9.4" cy="10.4" r="1.5" />
      <circle cx="13.6" cy="13" r="1.5" />
      <path d="M5.4 6.6C4 5.8 3.2 4.6 3 3" />
    </>
  ),
  // Las semillas sueltas, que es lo que se ve encima del pan.
  ajonjoli: (
    <>
      <ellipse cx="7.4" cy="8" rx="1.9" ry="2.8" transform="rotate(-25 7.4 8)" />
      <ellipse cx="15.6" cy="7.4" rx="1.9" ry="2.8" transform="rotate(20 15.6 7.4)" />
      <ellipse cx="11.6" cy="13.4" rx="1.9" ry="2.8" transform="rotate(-10 11.6 13.4)" />
      <ellipse cx="17" cy="15.4" rx="1.9" ry="2.8" transform="rotate(35 17 15.4)" />
      <ellipse cx="6.4" cy="16.6" rx="1.9" ry="2.8" transform="rotate(15 6.4 16.6)" />
    </>
  ),
  // El frasco con su tapa.
  mostaza: (
    <>
      <path d="M7.6 20.5V10c0-1.6.9-2.8 2.4-3.2V4.5h4v2.3c1.5.4 2.4 1.6 2.4 3.2v10.5z" />
      <path d="M7.6 12.6h8.8" />
    </>
  ),
  // El tallo con sus hojas arriba.
  apio: (
    <>
      <path d="M9.4 20.5c-.7-4.6-.5-9 .6-13.4M14.6 20.5c.7-4.6.5-9-.6-13.4M12 20.5V7" />
      <path d="M12 7c0-2.2 1.4-3.6 3.6-4-.2 2.4-1.5 3.8-3.6 4z" />
      <path d="M12 7c0-2.2-1.4-3.6-3.6-4 .2 2.4 1.5 3.8 3.6 4z" />
    </>
  ),
  // La copa de vino: el sulfito que la gente encuentra es el del vino.
  sulfitos: (
    <>
      <path d="M6.6 3.5h10.8l-.7 5.4a5 5 0 0 1-9.4 0z" />
      <path d="M12 14.3v6.2M8.4 20.5h7.2" />
    </>
  ),
};

// Una etiqueta del catálogo puede llegar antes que su dibujo: se agrega con un
// INSERT y el icono se dibuja después. Este círculo con su punto es lo que se
// pinta mientras tanto —una marca, sin decir de qué— en vez de un hueco donde
// las demás tienen algo.
const GENERICO = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8.4v4.4M12 16h.01" />
  </>
);

export function IconoEtiqueta({ slug, ancho = 16 }) {
  return <Svg ancho={ancho}>{DIBUJOS[slug] ?? GENERICO}</Svg>;
}
