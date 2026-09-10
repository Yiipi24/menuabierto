"use client";

import { useEffect, useState, useTransition } from "react";
import { TIPOS_DE_AVISO } from "../../../lib/avisos";
import { borrarSuscripcionPush, guardarPreferenciasPush, guardarSuscripcionPush } from "./actions";

// Los avisos por push, desde la cuenta: un interruptor para este navegador y
// uno por tipo de aviso. Apagar el general se da de baja de verdad —se borra
// la suscripción— y no solo esconde el interruptor.

function aUint8(base64) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(b);
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

export default function AvisosDeCuenta({ prefs, llavePublica, habilitado }) {
  const [soporte, setSoporte] = useState(null);
  const [activo, setActivo] = useState(false);
  const [permiso, setPermiso] = useState("default");
  const [preferencias, setPreferencias] = useState(prefs);
  const [mensaje, setMensaje] = useState(null);
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    const hay = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSoporte(hay);
    if (!hay) return;
    setPermiso(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setActivo(Boolean(sub)))
      .catch(() => setActivo(false));
  }, []);

  function encender() {
    setMensaje(null);
    empezar(async () => {
      try {
        const permiso = await Notification.requestPermission();
        setPermiso(permiso);
        if (permiso !== "granted") {
          setMensaje({ tipo: "err", texto: "Sin permiso del navegador no hay avisos. Lo puedes cambiar en los ajustes del sitio." });
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: aUint8(llavePublica),
          }));
        const r = await guardarSuscripcionPush(JSON.stringify(sub.toJSON()));
        if (r.status !== "ok") throw new Error(r.message);
        setActivo(true);
        setMensaje({ tipo: "ok", texto: "Listo: los avisos llegan a este dispositivo." });
      } catch (error) {
        console.error("encender push", error);
        setMensaje({ tipo: "err", texto: "No pudimos encender los avisos aquí. Inténtalo otra vez." });
      }
    });
  }

  function apagar() {
    setMensaje(null);
    empezar(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await borrarSuscripcionPush(sub.endpoint);
          await sub.unsubscribe();
        }
        setActivo(false);
        setMensaje({ tipo: "ok", texto: "Avisos apagados en este dispositivo." });
      } catch (error) {
        console.error("apagar push", error);
        setMensaje({ tipo: "err", texto: "No pudimos apagar los avisos. Inténtalo otra vez." });
      }
    });
  }

  function alternar(slug) {
    const siguiente = { ...preferencias, [slug]: !preferencias[slug] };
    setPreferencias(siguiente);
    empezar(async () => {
      const r = await guardarPreferenciasPush(JSON.stringify(siguiente));
      if (r.status !== "ok") setMensaje({ tipo: "err", texto: r.message });
    });
  }

  if (!habilitado) {
    return <p className="nota-borrador">Los avisos por push todavía no están habilitados en este sitio.</p>;
  }
  if (soporte === false) {
    return (
      <p className="nota-borrador">
        Este navegador no admite avisos. En iPhone hay que instalar primero la aplicación desde Safari
        (Compartir → Agregar a pantalla de inicio) y abrirla desde ahí.
      </p>
    );
  }

  return (
    <div className="avisos-cuenta">
      <div className="avisos-cuenta-fila">
        <div>
          <strong>Avisos en este dispositivo</strong>
          <p className="ayuda">
            {activo
              ? "Encendidos. Llegan aunque tengas la aplicación cerrada."
              : permiso === "denied"
                ? "El navegador los tiene bloqueados para este sitio; cámbialo en sus ajustes."
                : "Apagados. Enciéndelos para enterarte sin abrir la aplicación."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          aria-label="Avisos en este dispositivo"
          className={activo ? "switch encendido" : "switch"}
          disabled={pendiente || soporte === null || permiso === "denied"}
          onClick={activo ? apagar : encender}
        >
          <span className="switch-bolita" />
        </button>
      </div>

      <ul className="avisos-cuenta-tipos" aria-label="Qué avisos recibir">
        {TIPOS_DE_AVISO.map((t) => (
          <li key={t.slug} className="avisos-cuenta-fila">
            <div>
              <strong>{t.nombre}</strong>
              <p className="ayuda">{t.pista}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferencias[t.slug]}
              aria-label={t.nombre}
              className={preferencias[t.slug] ? "switch encendido" : "switch"}
              disabled={pendiente}
              onClick={() => alternar(t.slug)}
            >
              <span className="switch-bolita" />
            </button>
          </li>
        ))}
      </ul>

      {mensaje ? (
        <p className={`form-msg ${mensaje.tipo}`} role={mensaje.tipo === "ok" ? "status" : "alert"}>
          {mensaje.texto}
        </p>
      ) : null}
      <p className="ayuda">
        Las preferencias valen para todos tus dispositivos; el interruptor de arriba, solo para este.
        Apagarlo se da de baja de verdad: no guardamos a dónde mandarte nada.
      </p>
    </div>
  );
}
