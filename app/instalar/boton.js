"use client";

import { useEffect, useState } from "react";

// El botón de instalar. En Android (Chrome, Edge, Samsung) el navegador da un
// evento y se instala con un toque; en iOS no hay evento: Safari solo instala
// desde Compartir → "Agregar a pantalla de inicio", y aquí se explica.
export default function BotonInstalar() {
  const [instalable, setInstalable] = useState(false);
  const [instalada, setInstalada] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) && !window.MSStream);
    setInstalada(window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true);
    setInstalable(Boolean(window.__instalarMenuAbierto));
    const marcar = () => setInstalable(true);
    window.addEventListener("menuabierto:instalable", marcar);
    const lista = () => setInstalada(true);
    window.addEventListener("appinstalled", lista);
    return () => {
      window.removeEventListener("menuabierto:instalable", marcar);
      window.removeEventListener("appinstalled", lista);
    };
  }, []);

  async function instalar() {
    const evento = window.__instalarMenuAbierto;
    if (!evento) return;
    evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") setInstalada(true);
    window.__instalarMenuAbierto = null;
    setInstalable(false);
  }

  if (instalada) {
    return <p className="form-msg ok">Ya tienes Menú Abierto instalado en este dispositivo.</p>;
  }

  if (instalable) {
    return (
      <button className="btn" type="button" onClick={instalar}>
        Instalar Menú Abierto
      </button>
    );
  }

  if (ios) {
    return (
      <ol className="instalar-pasos">
        <li>Abre esta página en <strong>Safari</strong> (en otros navegadores de iPhone no se puede instalar).</li>
        <li>Toca el botón <strong>Compartir</strong>: el cuadrado con la flecha hacia arriba.</li>
        <li>Elige <strong>Agregar a pantalla de inicio</strong> y confirma.</li>
      </ol>
    );
  }

  return (
    <ol className="instalar-pasos">
      <li>En <strong>Chrome</strong> o <strong>Edge</strong>, abre el menú de los tres puntos.</li>
      <li>Toca <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla de inicio</strong>.</li>
    </ol>
  );
}
