"use client";

import { useRef, useState } from "react";
import { IconoDescargar } from "./iconos";

// El QR de la ficha vive en la pantalla, pero donde sirve de verdad es impreso:
// en la mesa, en la entrada y en la cuenta. Sin una descarga, el dueño acababa
// tomándole una captura de pantalla, y una captura de 300 px de ancho ampliada
// a un letrero sale borrosa y con los bordes de los módulos comidos.
//
// Se ofrecen los dos formatos a propósito: el SVG es el bueno para la
// imprenta, porque no tiene resolución y se puede poner del tamaño de una
// puerta; el PNG es el que aceptan Word, Canva y el chat del que hace las
// lonas.
const LADO_PNG = 1600;

// El SVG de la ficha pinta los módulos con `var(--ink)`, que solo existe
// dentro de la página. Fuera de ella —dentro del archivo descargado, o cuando
// el navegador lo carga como imagen para rasterizarlo— esa variable no
// resuelve y el QR sale invisible. La copia que se exporta lleva el color ya
// escrito.
function copiaExportable(svg) {
  const copia = svg.cloneNode(true);
  const tinta =
    getComputedStyle(svg).getPropertyValue("--ink").trim() || "#111111";

  copia.removeAttribute("class");
  copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copia.setAttribute("width", LADO_PNG);
  copia.setAttribute("height", LADO_PNG);
  for (const g of copia.querySelectorAll("[fill='var(--ink)']")) {
    g.setAttribute("fill", tinta);
  }
  return copia;
}

function descargar(nombre, url) {
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
}

export default function QrDescarga({ nombreArchivo, children }) {
  const caja = useRef(null);
  const [error, setError] = useState(false);

  function svgActual() {
    return caja.current?.querySelector("svg") ?? null;
  }

  function bajarSvg() {
    const svg = svgActual();
    if (!svg) return;

    const texto = new XMLSerializer().serializeToString(copiaExportable(svg));
    const url = URL.createObjectURL(new Blob([texto], { type: "image/svg+xml" }));
    descargar(`${nombreArchivo}.svg`, url);
    // Revocar de inmediato cancelaría la descarga en Safari, que lee la URL
    // después de que vuelve el clic.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function bajarPng() {
    const svg = svgActual();
    if (!svg) return;

    const texto = new XMLSerializer().serializeToString(copiaExportable(svg));
    const fuente = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`;

    const imagen = new Image();
    imagen.onload = () => {
      const lienzo = document.createElement("canvas");
      lienzo.width = LADO_PNG;
      lienzo.height = LADO_PNG;
      const ctx = lienzo.getContext("2d");
      // El fondo blanco va explícito: un PNG transparente impreso sobre papel
      // de color deja de tener el contraste que el lector necesita.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, LADO_PNG, LADO_PNG);
      ctx.drawImage(imagen, 0, 0, LADO_PNG, LADO_PNG);

      lienzo.toBlob((blob) => {
        if (!blob) {
          setError(true);
          return;
        }
        const url = URL.createObjectURL(blob);
        descargar(`${nombreArchivo}.png`, url);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }, "image/png");
    };
    // Si el navegador no puede rasterizar el SVG, queda el SVG, que es el
    // formato que la imprenta prefiere de todos modos.
    imagen.onerror = () => setError(true);
    imagen.src = fuente;
  }

  return (
    <div className="qr-descarga" ref={caja}>
      {children}
      <div className="qr-descarga-botones">
        <button type="button" className="btn-linea" onClick={bajarPng}>
          <IconoDescargar ancho={16} />
          PNG
        </button>
        <button type="button" className="btn-linea" onClick={bajarSvg}>
          <IconoDescargar ancho={16} />
          SVG
        </button>
      </div>
      <p className="qr-descarga-nota">
        {error
          ? "No pudimos generar el PNG en este navegador. Descarga el SVG: es el que pide la imprenta."
          : "Para imprimir. El SVG no pierde nitidez por grande que lo pongas."}
      </p>
    </div>
  );
}
