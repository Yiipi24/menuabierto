"use client";

import { useEffect, useState } from "react";

// La navegación interna de la ficha: seis anclas que bajan a su sección.
//
// El scroll suave lo pone el `scroll-behavior` del documento, así que esto
// son enlaces de toda la vida y funcionan sin JavaScript. Lo que sí hace el
// script es marcar cuál sección se está viendo, para que la barra diga en
// dónde está uno y no solo a dónde puede ir.
//
// Solo se pintan las secciones que existen: un restaurante sin publicaciones
// no tiene "Novedades" a dónde bajar, y un enlace muerto es peor que ninguno.
export default function Subnav({ secciones }) {
  const [activa, setActiva] = useState(secciones[0]?.id ?? null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const nodos = secciones.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!nodos.length) return undefined;

    // La franja de referencia es el tercio superior de la ventana: la sección
    // activa es la que ocupa lo que se está leyendo, no la que asoma abajo.
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: "-140px 0px -60% 0px", threshold: 0 },
    );
    nodos.forEach((n) => observador.observe(n));
    return () => observador.disconnect();
  }, [secciones]);

  if (!secciones.length) return null;

  return (
    <nav className="subnav" aria-label="Secciones de la página">
      <div className="wrap wrap-ficha subnav-inner">
        <ul className="subnav-lista">
          {secciones.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={activa === s.id ? "subnav-enlace es-activa" : "subnav-enlace"}
                aria-current={activa === s.id ? "location" : undefined}
                onClick={() => setActiva(s.id)}
              >
                {s.nombre}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
