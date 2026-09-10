"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// La puerta de entrada de las acciones sociales.
//
// A quien no ha entrado no se le esconde el botón: se le enseña, y al pulsarlo
// se le pide la cuenta. Lo que hace que esto no sea un muro es que la acción no
// se pierde: se apunta antes de mandar a /entrar y se ejecuta sola al volver,
// así que la persona regresa a la misma publicación con su corazón ya rojo en
// vez de a una página que no recuerda qué estaba haciendo.
//
// La nota va en `sessionStorage` y no en la URL: cabe cualquier cosa, se muere
// con la pestaña y no deja una dirección rara para compartir. Si el navegador
// no lo permite —modo privado de los estrictos— la puerta sigue funcionando y
// lo único que se pierde es el "y después completa la acción", que es la
// mejora, no el mecanismo.

const LLAVE = "ma-pendiente";

function guardar(nota) {
  try {
    sessionStorage.setItem(LLAVE, JSON.stringify(nota));
  } catch {
    // Sin almacenamiento la persona entra igual y repite el clic.
  }
}

function recoger() {
  try {
    const crudo = sessionStorage.getItem(LLAVE);
    if (!crudo) return null;
    sessionStorage.removeItem(LLAVE);
    return JSON.parse(crudo);
  } catch {
    return null;
  }
}

/**
 * Lo que usan los botones. Devuelve:
 *  - `pedirCuenta(nota)`: apunta la acción y enseña el aviso con el enlace.
 *  - `aviso`: qué acción quedó pendiente, o null.
 *  - `AvisoPuerta`: el cartelito, ya listo para pintar.
 *  - `alVolver(fn)`: se llama sola, una vez, con la nota que quedó apuntada.
 */
export function usePuerta(volverA) {
  const [aviso, setAviso] = useState(null);

  const pedirCuenta = useCallback((nota) => {
    if (nota) guardar({ ...nota, volverA });
    setAviso(nota ?? { que: "esto" });
  }, [volverA]);

  const limpiar = useCallback(() => setAviso(null), []);

  return { aviso, pedirCuenta, limpiar, volverA };
}

/**
 * El otro extremo: al montar, si hay una acción apuntada que es de este
 * componente, la ejecuta. `coincide` decide si la nota le corresponde —cada
 * botón mira solo la suya— y `hacer` la completa.
 */
export function useAccionPendiente(coincide, hacer, listo = true) {
  useEffect(() => {
    if (!listo) return;

    let nota = null;
    try {
      const crudo = sessionStorage.getItem(LLAVE);
      nota = crudo ? JSON.parse(crudo) : null;
    } catch {
      nota = null;
    }
    if (!nota || !coincide(nota)) return;

    // Se saca de la nota antes de ejecutarla: si la acción falla, no queda
    // dando vueltas para repetirse en cada carga.
    recoger();
    hacer(nota);
    // Las dependencias van vacías a propósito: esto corre una vez, al llegar de
    // vuelta del inicio de sesión, y no cada vez que el padre se repinta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);
}

// El cartel. Dice qué falta y lleva de vuelta al mismo sitio, no a la portada.
export function AvisoPuerta({ aviso, volverA, alCerrar }) {
  if (!aviso) return null;

  const destino = encodeURIComponent(volverA || "/");

  return (
    <p className="social-puerta" role="status">
      <span>{aviso.texto ?? "Entra a tu cuenta para continuar."}</span>
      <span className="social-puerta-enlaces">
        <Link href={`/entrar?next=${destino}`}>Iniciar sesión</Link>
        <Link href={`/registro?next=${destino}`}>Crear cuenta</Link>
        {alCerrar ? (
          <button type="button" className="social-puerta-cerrar" onClick={alCerrar}>
            Ahora no
          </button>
        ) : null}
      </span>
    </p>
  );
}
