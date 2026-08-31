"use client";

import { useEffect } from "react";

// Un chunk que no carga suele venir de dos sitios: la red del visitante se
// cayó a media navegación, o acabamos de desplegar y el archivo que su pestaña
// pedía ya no existe. En ambos casos recargar lo arregla, así que lo hacemos
// nosotros en vez de dejar a la persona ante un error que no entiende.
const esChunk = (error) =>
  error?.name === "ChunkLoadError" ||
  /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported/i.test(
    error?.message ?? "",
  );

export default function Error({ error, reset }) {
  useEffect(() => {
    if (!esChunk(error)) return;
    // Una sola vez: si la recarga tampoco arregla, mostramos la pantalla en
    // vez de dejar al navegador en un bucle de recargas.
    try {
      if (sessionStorage.getItem("ma-recarga") === "1") return;
      sessionStorage.setItem("ma-recarga", "1");
      window.location.reload();
    } catch {
      // Modo privado sin sessionStorage: mejor no recargar que arriesgar el bucle.
    }
  }, [error]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem("ma-recarga");
      } catch {}
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="panel-shell">
      <div className="panel-card">
        <h1>Algo se interrumpió</h1>
        <p className="panel-lead">
          Puede haber sido tu conexión, o una actualización del sitio mientras
          navegabas. Vuelve a intentarlo.
        </p>
        <button className="btn btn-block" type="button" onClick={() => reset()}>
          Reintentar
        </button>
        <p className="ayuda">
          Si sigue pasando, recarga la página completa con Ctrl+Shift+R.
        </p>
      </div>
    </main>
  );
}
