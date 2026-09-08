"use client";

import { useEffect } from "react";

// "Descargar en PDF" no baja un archivo: abre la carta con el diálogo de
// impresión del navegador, que en todos ellos ofrece "Guardar como PDF".
//
// Es lo mismo que haría un generador de PDF en el servidor, pero sale de la
// misma página que ya existe: la carta se ve idéntica a la que abre el QR, con
// la plantilla que eligió el dueño, y no hay una segunda maqueta que se quede
// atrás cada vez que se toque la primera.
//
// La bandera se lee de `window.location` y no con `useSearchParams` a
// propósito: ese hook obliga a envolver la página en un Suspense y a que la
// ruta deje de poderse guardar, y aquí basta con mirar la dirección una vez ya
// montados.
export default function Imprimir() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pdf") !== "1") return undefined;

    // Sin esperar a las letras, la carta se imprime con la del sistema y los
    // renglones quedan donde no van. `document.fonts` no está en todos lados,
    // así que su ausencia solo significa imprimir de inmediato.
    const listo = document.fonts?.ready ?? Promise.resolve();
    let vivo = true;
    listo.then(() => {
      if (vivo) window.print();
    });
    return () => {
      vivo = false;
    };
  }, []);

  return null;
}
