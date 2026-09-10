"use client";

import { useEffect } from "react";

// Registra el service worker y guarda el evento de instalación de Android
// para que /instalar lo pueda disparar con un botón. Vive en el layout, así
// que corre en todas las páginas; no pinta nada.
export default function RegistroPwa() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("service worker", error);
    });

    const guardar = (evento) => {
      evento.preventDefault();
      window.__instalarMenuAbierto = evento;
      window.dispatchEvent(new Event("menuabierto:instalable"));
    };
    window.addEventListener("beforeinstallprompt", guardar);
    return () => window.removeEventListener("beforeinstallprompt", guardar);
  }, []);
  return null;
}
