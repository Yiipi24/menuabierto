"use client";

import { useEffect, useRef, useState } from "react";
import { IconoCompartir } from "../_ficha/iconos";
import { IconoRed } from "../redes-iconos";
import { IconoEnlace } from "./iconos";

// Compartir una publicación, al lado del corazón y de los comentarios.
//
// Lo que se comparte es la ficha del restaurante y no un enlace propio de la
// pieza: una publicación no tiene página suya, y mandar a alguien a la ficha es
// donde de verdad puede ver el resto y llegar al lugar.
//
// En el teléfono se usa el compartir del sistema, que ya trae las apps que esa
// persona tiene instaladas; en el escritorio, donde eso casi nunca existe, se
// abre un menú con las tres redes de siempre y el enlace para copiar. Nada de
// esto necesita una API de nadie: son las direcciones públicas de compartir.
const REDES = [
  {
    slug: "whatsapp",
    nombre: "WhatsApp",
    url: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`,
  },
  {
    slug: "facebook",
    nombre: "Facebook",
    url: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
  },
  {
    slug: "x",
    nombre: "X",
    url: (u, t) =>
      `https://x.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
];

export default function Compartir({ ruta, titulo, texto }) {
  const caja = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // El menú se cierra al tocar fuera o con Escape: si no, se queda abierto
  // encima de la publicación siguiente.
  useEffect(() => {
    if (!abierto) return undefined;
    function fuera(e) {
      if (!caja.current?.contains(e.target)) setAbierto(false);
    }
    function escape(e) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  useEffect(() => {
    if (!copiado) return undefined;
    const t = setTimeout(() => setCopiado(false), 2200);
    return () => clearTimeout(t);
  }, [copiado]);

  // La dirección se arma en el navegador: es el mismo dominio desde el que se
  // está viendo, así que sirve igual en producción, en una vista previa y en
  // local, sin pasarla desde el servidor.
  function direccion() {
    if (typeof window === "undefined") return ruta;
    return new URL(ruta, window.location.origin).toString();
  }

  const mensaje = texto?.trim() ? `${titulo}: ${texto.trim()}` : titulo;

  async function compartir() {
    const url = direccion();

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: titulo, text: mensaje, url });
        return;
      } catch (error) {
        // Cancelar el compartir del sistema no es un fallo y no abre nada más.
        if (error?.name === "AbortError") return;
      }
    }

    setAbierto((v) => !v);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(direccion());
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles queda el menú abierto con las redes, que
      // es mejor que un botón que no hace nada.
      setCopiado(false);
    }
  }

  return (
    <div className="publicacion-compartir" ref={caja}>
      <button
        type="button"
        className="publicacion-accion"
        onClick={compartir}
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <IconoCompartir ancho={19} />
        Compartir
      </button>

      {abierto ? (
        <div className="publicacion-compartir-menu" role="menu">
          {REDES.map((red) => (
            <a
              key={red.slug}
              role="menuitem"
              href={red.url(direccion(), mensaje)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAbierto(false)}
            >
              <IconoRed slug={red.slug} ancho={18} />
              {red.nombre}
            </a>
          ))}
          <button type="button" role="menuitem" onClick={copiar}>
            <IconoEnlace ancho={18} />
            {copiado ? "Enlace copiado" : "Copiar enlace"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
