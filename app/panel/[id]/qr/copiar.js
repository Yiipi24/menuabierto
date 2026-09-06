"use client";

import { useEffect, useState } from "react";

// El dueño casi nunca imprime desde el celular: manda el enlace por WhatsApp a
// quien le hace las lonas, o lo pega en su bio. Copiarlo a mano de una
// pantalla —siete caracteres sin sentido, sin mayúsculas, sin la o ni el uno—
// es donde se equivoca.
export default function CopiarEnlace({ url }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return undefined;
    const t = setTimeout(() => setCopiado(false), 2200);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // Safari sin permiso de portapapeles: se selecciona el texto para que
      // el copiar de siempre funcione, que es mejor que un botón muerto.
      const nodo = document.getElementById("qr-enlace");
      if (!nodo) return;
      const rango = document.createRange();
      rango.selectNodeContents(nodo);
      const seleccion = window.getSelection();
      seleccion?.removeAllRanges();
      seleccion?.addRange(rango);
    }
  }

  return (
    <div className="qr-enlace">
      <code id="qr-enlace">{url}</code>
      <button type="button" className="btn-linea" onClick={copiar}>
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
