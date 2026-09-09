"use client";

import { useState } from "react";

// "Cerca de mí" para la búsqueda por precio: pide la ubicación al navegador y
// la mete en el formulario como lat/lng. Sin JavaScript el formulario sigue
// funcionando con el lugar escrito.
export default function BotonCerca() {
  const [estado, setEstado] = useState("idle");

  function ubicar() {
    if (!navigator.geolocation) {
      setEstado("error");
      return;
    }
    setEstado("buscando");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const form = document.getElementById("form-precios");
        if (!form) return;
        form.lat.value = pos.coords.latitude.toFixed(5);
        form.lng.value = pos.coords.longitude.toFixed(5);
        form.lugar.value = "";
        form.requestSubmit();
      },
      () => setEstado("error"),
      { timeout: 8000, maximumAge: 60000 },
    );
  }

  return (
    <button type="button" className="btn-texto" onClick={ubicar} disabled={estado === "buscando"}>
      {estado === "buscando" ? "Buscando tu ubicación…" : estado === "error" ? "No pudimos ubicarte; escribe la zona" : "Cerca de mí"}
    </button>
  );
}
