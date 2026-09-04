"use client";

import { useEffect, useRef, useState } from "react";
import { fuenteDeReferente } from "../lib/eventos";
import { IconoMarcador } from "./_ficha/iconos";

// Lo que el panel enseña sale de aquí: cada cosa que alguien hace en una ficha
// pública se manda a /api/eventos. No se guarda quién; el servidor pone una
// cookie anónima y la ciudad la da el borde de Vercel.
//
// Nada de esto puede estorbar a la página: si la red falla, el evento se
// pierde en silencio. Medir nunca vale un error en la cara del comensal.

const LLAVE_FUENTE = "ma-fuente";
const LLAVE_GUARDADOS = "ma-guardados";

// La fuente se decide una vez por pestaña y se recuerda: si alguien llega por
// el QR y luego toca "Ver menú", esa segunda página sigue siendo tráfico de
// QR y no un clic interno.
function fuenteActual() {
  if (typeof window === "undefined") return "directo";

  try {
    const guardada = sessionStorage.getItem(LLAVE_FUENTE);
    if (guardada) return guardada;
  } catch {
    // Navegación privada sin almacenamiento: se calcula cada vez y ya.
  }

  const params = new URLSearchParams(window.location.search);
  const marca = (params.get("src") || params.get("utm_source") || "").toLowerCase();
  const fuente =
    marca === "qr"
      ? "qr"
      : fuenteDeReferente(document.referrer, window.location.hostname);

  try {
    sessionStorage.setItem(LLAVE_FUENTE, fuente);
  } catch {
    // Igual que arriba: sin almacenamiento se sigue midiendo.
  }
  return fuente;
}

export function medir(slug, evento) {
  if (!slug || typeof window === "undefined") return;
  try {
    fetch("/api/eventos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, evento, fuente: fuenteActual() }),
      // keepalive para que el evento salga aunque el clic se lleve la página
      // por delante (un tel: o un enlace a Instagram).
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ni siquiera esto debe romper la ficha.
  }
}

/**
 * Registra la visita a una ficha. `eventos` son los tipos que corresponden a
 * esta página: la ficha manda `restaurant_view`, el menú manda además
 * `menu_view`, y cualquiera de las dos suma `qr_scan` si se llegó por el QR.
 */
export function MedirVista({ slug, eventos = ["restaurant_view"] }) {
  const yaFue = useRef(false);

  useEffect(() => {
    // En desarrollo React monta dos veces; el índice de la base también lo
    // atraparía, pero no hace falta gastar dos viajes.
    if (yaFue.current) return;
    yaFue.current = true;

    const lista = [...eventos];
    if (fuenteActual() === "qr") lista.push("qr_scan");
    for (const evento of lista) medir(slug, evento);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return null;
}

/**
 * Un enlace igual a los de siempre que además avisa qué se tocó. Se usa para
 * el teléfono, el sitio web, las redes y "cómo llegar".
 */
export function EnlaceMedido({ slug, evento, children, ...resto }) {
  return (
    <a {...resto} onClick={() => medir(slug, evento)}>
      {children}
    </a>
  );
}

/**
 * Guardar una ficha. Vive en el navegador de quien la guarda (no hay listas
 * de favoritos todavía) y le avisa al restaurante que alguien lo apartó.
 */
export function BotonGuardar({ slug, nombre }) {
  const [guardado, setGuardado] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      const lista = JSON.parse(localStorage.getItem(LLAVE_GUARDADOS) ?? "[]");
      setGuardado(Array.isArray(lista) && lista.includes(slug));
    } catch {
      setGuardado(false);
    }
    setListo(true);
  }, [slug]);

  function alternar() {
    let lista = [];
    try {
      const crudo = JSON.parse(localStorage.getItem(LLAVE_GUARDADOS) ?? "[]");
      if (Array.isArray(crudo)) lista = crudo;
    } catch {
      lista = [];
    }

    const ahora = !guardado;
    const nueva = ahora ? [...new Set([...lista, slug])] : lista.filter((s) => s !== slug);
    try {
      localStorage.setItem(LLAVE_GUARDADOS, JSON.stringify(nueva));
    } catch {
      // Sin almacenamiento el botón no recuerda, pero el evento sí cuenta.
    }

    setGuardado(ahora);
    // Solo se mide guardar. Quitarlo no es un evento negativo que el panel
    // sepa contar, y restarlo falsearía el histórico.
    if (ahora) medir(slug, "restaurant_save");
  }

  return (
    <button
      type="button"
      className={`ficha-guardar${guardado ? " guardado" : ""}`}
      onClick={alternar}
      aria-pressed={listo ? guardado : undefined}
      title={guardado ? `Quitar ${nombre} de tus guardados` : `Guardar ${nombre}`}
    >
      <IconoMarcador ancho={18} />
      {guardado ? "Guardado" : "Guardar"}
    </button>
  );
}
