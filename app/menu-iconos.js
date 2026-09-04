// El icono del platillo es un dibujo de trazo, no una foto. La razón es la
// misma por la que los destacados tienen icono y no imagen: una foto decente
// de cada platillo es trabajo que el dueño no va a hacer, y una foto mala se
// ve peor que no tener ninguna. El dibujo pesa cero, se ve igual en las cinco
// plantillas y da el aire de menú de pizarrón sin pedirle nada a nadie.
//
// Si el dueño no elige, se adivina del nombre: "Burger brisket" trae la
// hamburguesa sola. Puede corregirlo desde el editor, o quitarlo.

import { ICONO_GENERICO } from "../lib/iconos-platillo";

function Svg({ children, ancho = 26 }) {
  return (
    <svg
      className="icono icono-platillo"
      width={ancho}
      height={ancho}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
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
  hamburguesa: (
    <>
      <path d="M5 12.5c0-3.9 4.9-6.5 11-6.5s11 2.6 11 6.5z" />
      <path d="M5 15.5h22M5 19h22" />
      <path d="M5 22.5c0 2.2 2 3.5 4.4 3.5h13.2c2.4 0 4.4-1.3 4.4-3.5z" />
      <path d="M10 9.6h.01M16 8.6h.01M22 9.6h.01" />
    </>
  ),
  cerdo: (
    <>
      <path d="M6 13.5 4.5 9l4.4 2.1M26 13.5 27.5 9l-4.4 2.1" />
      <path d="M16 9.8c6 0 10.5 3.4 10.5 7.8S22 25.4 16 25.4 5.5 22 5.5 17.6 10 9.8 16 9.8z" />
      <path d="M13 16.6h.01M19 16.6h.01" />
      <ellipse cx="16" cy="20.4" rx="3.4" ry="2.4" />
      <path d="M14.8 20.4h.01M17.2 20.4h.01" />
    </>
  ),
  carne: (
    <>
      <path d="M20.6 5.6c4 0 7 3 7 6.8 0 4.9-4.3 7.6-6.7 10.9-1.9 2.6-3.8 4.7-7.5 4.7-4.9 0-9.4-3.7-9.4-8.9 0-6.6 7.4-13.5 16.6-13.5z" />
      <path d="M17.7 11.6c2.6 0 4.3 1.7 4.3 3.9 0 2.4-1.9 4.2-4.3 4.2s-4.3-1.8-4.3-4.2c0-2.2 1.7-3.9 4.3-3.9z" />
    </>
  ),
  pollo: (
    <>
      <path d="M11.6 6.4a4 4 0 0 1 7.5 1.4l6.5 12.4c1 1.9.2 4.2-1.8 5.1-1.8.8-4 .1-5-1.7L11.4 12" />
      <path d="M11.6 6.4C8.2 7 5.7 9.6 5.7 12.6c0 2.4 1.6 4.2 3.9 4.9" />
      <path d="M22.4 22.6h.01" />
    </>
  ),
  taco: (
    <>
      <path d="M4 20a12 12 0 0 1 24 0" />
      <path d="M4 20c0 2.2 1.6 3.6 3.6 3.6h16.8c2 0 3.6-1.4 3.6-3.6" />
      <path d="M10 16.5h.01M16 14.8h.01M22 16.5h.01M13 19.6h.01M19 19.6h.01" />
    </>
  ),
  burrito: (
    <>
      <path d="M7.6 24.6 24.4 7.8a5.6 5.6 0 0 1 0 8L15.6 24.6a5.6 5.6 0 0 1-8 0z" />
      <path d="M24.4 7.8a5.6 5.6 0 0 0-8 0l-8.8 8.8a5.6 5.6 0 0 0 0 8" />
      <path d="M14 15.5h.01M17.5 12h.01M11 19h.01" />
    </>
  ),
  pizza: (
    <>
      <path d="M16 4.6 28 25.2c-3.4 1.8-7.6 2.7-12 2.7S7.4 27 4 25.2z" />
      <path d="M6.6 23.2c2.8 1.2 6 1.8 9.4 1.8s6.6-.6 9.4-1.8" />
      <path d="M13.6 13h.01M18.4 18h.01M12 20.4h.01" />
    </>
  ),
  pescado: (
    <>
      <path d="M3.4 16c3.5-4.6 7.6-6.9 12.2-6.9S24.3 11.4 27.8 16c-3.5 4.6-7.6 6.9-12.2 6.9S6.9 20.6 3.4 16z" />
      <path d="M21 16h.01M7.4 11.6 11 16l-3.6 4.4" />
    </>
  ),
  camaron: (
    <>
      <path d="M26 10c-7 0-11 3.4-11 8.4 0 3.6-2.6 6.2-6.2 6.2C5.4 24.6 3 22.2 3 19" />
      <path d="M26 10c-2.4 5-6 7.6-10.8 7.8" />
      <path d="M23 6.6 26 10l-3.4 2.8M9 20.6h.01" />
    </>
  ),
  ensalada: (
    <>
      <path d="M4.6 16h22.8c0 5.4-4.6 9.4-11.4 9.4S4.6 21.4 4.6 16z" />
      <path d="M9 13c1-3.4 3.7-5.4 7-5.4 3.3 0 6 2 7 5.4" />
      <path d="M12.5 12.4c.8-1.6 2-2.6 3.5-2.6" />
    </>
  ),
  sopa: (
    <>
      <path d="M4.6 14h22.8c0 6-4.6 10.4-11.4 10.4S4.6 20 4.6 14z" />
      <path d="M3 27h26" />
      <path d="M12 9.6c-1.2-1.2-1.2-2.6 0-3.8M16.6 9.6c-1.2-1.2-1.2-2.6 0-3.8M21.2 9.6c-1.2-1.2-1.2-2.6 0-3.8" />
    </>
  ),
  papas: (
    <>
      <path d="M9 13h14l-1.6 12.4a2 2 0 0 1-2 1.8h-6.8a2 2 0 0 1-2-1.8z" />
      <path d="M9 17h14" />
      <path d="M12.4 12.6 11 5.4M16 12.6V4.6M19.6 12.6 21 5.4" />
    </>
  ),
  postre: (
    <>
      <path d="M6 15h20v9.4a2.6 2.6 0 0 1-2.6 2.6H8.6A2.6 2.6 0 0 1 6 24.4z" />
      <path d="M6 19.4h20" />
      <path d="M16 15V9.6M16 8.4a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8z" />
    </>
  ),
  helado: (
    <>
      <path d="M9.6 13.4h12.8L16 27.4z" />
      <path d="M9.4 13.4a3.4 3.4 0 0 1 1.4-6.2 5.4 5.4 0 0 1 10.4 0 3.4 3.4 0 0 1 1.4 6.2" />
    </>
  ),
  cafe: (
    <>
      <path d="M5 11h16v8.4a5.6 5.6 0 0 1-5.6 5.6h-4.8A5.6 5.6 0 0 1 5 19.4z" />
      <path d="M21 12.8h2.4a3.4 3.4 0 0 1 0 6.8H21" />
      <path d="M9 7.6V5M13 7.6V5M17 7.6V5" />
    </>
  ),
  bebida: (
    <>
      <path d="M8 8h16l-2 17.4a2 2 0 0 1-2 1.8h-8a2 2 0 0 1-2-1.8z" />
      <path d="M8.8 14.6h14.4" />
      <path d="M19 8V4.6" />
    </>
  ),
  cerveza: (
    <>
      <path d="M8 10h12v15.4a1.8 1.8 0 0 1-1.8 1.8H9.8A1.8 1.8 0 0 1 8 25.4z" />
      <path d="M20 13h3.2a2.4 2.4 0 0 1 2.4 2.4v4a2.4 2.4 0 0 1-2.4 2.4H20" />
      <path d="M8 10c0-2.2 1.6-3.4 3.4-3.4.6-1.4 1.8-2 3.1-2 1.4 0 2.6.8 3.1 2C19.4 6.6 20 8 20 10" />
      <path d="M12 15v7.6M16 15v7.6" />
    </>
  ),
  coctel: (
    <>
      <path d="M5 7h22L16 19.4z" />
      <path d="M16 19.4V27M11 27h10" />
      <path d="M8.6 10.4h14.8" />
    </>
  ),
  pan: (
    <>
      <path d="M5 13c0-3 3.2-5 6.6-5h8.8c3.4 0 6.6 2 6.6 5 0 1.8-1.2 3-2.6 3.2v6.6a2 2 0 0 1-2 2H9.6a2 2 0 0 1-2-2v-6.6C6.2 16 5 14.8 5 13z" />
      <path d="M12 12.6v9.6M18 12.6v9.6" />
    </>
  ),
  queso: (
    <>
      <path d="M4 15.4 20 7c4.4 0 8 3.6 8 8H4z" />
      <path d="M4 15h24v6.4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M11 18.6h.01M18 19.4h.01M23.4 18h.01" />
    </>
  ),
  huevo: (
    <>
      <path d="M16 4.6c5 0 9 6.4 9 12.2 0 5.6-4 9.6-9 9.6s-9-4-9-9.6C7 11 11 4.6 16 4.6z" />
      <path d="M16 12.6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
    </>
  ),
  parrilla: (
    <>
      <path d="M4.6 12h22.8" />
      <path d="M6.6 12c0 6 4.2 10 9.4 10s9.4-4 9.4-10" />
      <path d="M11 22.6 9 27.4M21 22.6l2 4.8" />
      <path d="M12.6 8.4c-1.4-1.4-1.4-3 0-4.4M19.4 8.4c-1.4-1.4-1.4-3 0-4.4" />
    </>
  ),
  sandwich: (
    <>
      <path d="M4 12.4 16 6l12 6.4-12 6.4z" />
      <path d="M4 17.6 16 24l12-6.4" />
      <path d="M4 22.4 16 28.8l12-6.4" />
    </>
  ),
  picante: (
    <>
      <path d="M20 10.4c0 8-4.4 15-11.4 15C6 25.4 4.4 23.6 4.4 21.4c0-4.6 6-4.2 8.6-8.2 1.4-2.2 2-4.4 2.2-6.6" />
      <path d="M15.2 6.6c1.6-2.4 4.4-3 7-2-1 2.6-3 4-5.4 4.2" />
    </>
  ),
  fruta: (
    <>
      <path d="M16 10.6c-1.4-1.6-3.2-2.4-5.2-2.4C7 8.2 4.6 11.6 4.6 16c0 5.6 4.4 11.4 8 11.4 1.4 0 2.4-.6 3.4-.6s2 .6 3.4.6c3.6 0 8-5.8 8-11.4 0-4.4-2.4-7.8-6.2-7.8-2 0-3.8.8-5.2 2.4z" />
      <path d="M16 10.6V7a3.4 3.4 0 0 1 3.4-3.4" />
    </>
  ),
  cubiertos: (
    <>
      <path d="M9.4 4v9.4a2.6 2.6 0 0 0 2.6 2.6V4M12 16v12M6.8 4v6.6" />
      <path d="M22.6 4c-2.2 1.6-3.2 4-3.2 6.9 0 2.2 1 3.5 3.2 3.8V28" />
    </>
  ),
};

export function IconoPlatillo({ slug, ancho = 26 }) {
  const dibujo = DIBUJOS[slug] ?? DIBUJOS[ICONO_GENERICO];
  return <Svg ancho={ancho}>{dibujo}</Svg>;
}
