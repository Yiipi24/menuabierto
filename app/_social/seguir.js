"use client";

import { useState, useTransition } from "react";
import { alternarSeguir, alternarAlerta } from "./actions";
import { usarPuerta, useAccionPendiente, AvisoPuerta } from "./puerta";
import { conteo, plural } from "../../lib/social";
import {
  IconoCampana,
  IconoCampanaTachada,
  IconoSeguidores,
  IconoSeguir,
  IconoSiguiendo,
} from "./iconos";

// El bloque que va junto al nombre del restaurante: cuántos lo siguen, el botón
// de seguir y la campana de sus historias.
//
// Los tres cambian en cuanto se pulsan y solo después hablan con el servidor.
// Seguir no es una operación de la que haya que esperar confirmación, y si algo
// falla se regresa a como estaba. El número de seguidores se mueve con el
// botón: enseñar "1,248" mientras el botón ya dice "Siguiendo" se lee como si
// el clic no hubiera contado.

export default function Seguir({
  restauranteId,
  nombre,
  seguidores = 0,
  sigo = false,
  alerta = false,
  volverA,
}) {
  const [siguiendo, setSiguiendo] = useState(sigo);
  const [conAlerta, setConAlerta] = useState(alerta);
  const [cuantos, setCuantos] = useState(seguidores);
  const [pendiente, empezar] = useTransition();
  const { aviso, pedirCuenta, limpiar } = usarPuerta(volverA);

  function seguirAhora(valor) {
    setSiguiendo(valor);
    setCuantos((n) => Math.max(0, n + (valor ? 1 : -1)));
    // Dejar de seguir apaga la campana: una alerta de un restaurante que ya no
    // sigues no le llegaría a nadie, y dejarla encendida en la pantalla sería
    // prometer un aviso que no va a existir.
    if (!valor) setConAlerta(false);

    empezar(async () => {
      const r = await alternarSeguir(restauranteId, valor);
      if (!r.ok) {
        setSiguiendo(!valor);
        setCuantos((n) => Math.max(0, n + (valor ? -1 : 1)));
        if (r.motivo === "sesion") {
          pedirCuenta({
            que: "seguir",
            id: restauranteId,
            texto: `Entra a tu cuenta para seguir a ${nombre}.`,
          });
        }
      }
    });
  }

  function alertaAhora(valor) {
    setConAlerta(valor);
    if (valor && !siguiendo) {
      // Encender la campana sin seguir no significa nada, así que se hace lo
      // que la persona quiso decir: la deja siguiendo y con aviso.
      setSiguiendo(true);
      setCuantos((n) => n + 1);
    }

    empezar(async () => {
      const r = await alternarAlerta(restauranteId, valor);
      if (!r.ok) {
        setConAlerta(!valor);
        if (valor && !siguiendo) {
          setSiguiendo(false);
          setCuantos((n) => Math.max(0, n - 1));
        }
        if (r.motivo === "sesion") {
          pedirCuenta({
            que: "alerta",
            id: restauranteId,
            texto: `Entra a tu cuenta para que te avisemos de las historias de ${nombre}.`,
          });
        }
      }
    });
  }

  // Al volver de iniciar sesión se completa lo que quedó a medias.
  useAccionPendiente(
    (nota) => nota.id === restauranteId && (nota.que === "seguir" || nota.que === "alerta"),
    (nota) => (nota.que === "seguir" ? seguirAhora(true) : alertaAhora(true)),
  );

  return (
    <>
      <span className="social-seguidores">
        <IconoSeguidores ancho={19} />
        <strong>{conteo(cuantos)}</strong> {plural(cuantos, "seguidor", "seguidores")}
      </span>

      <span className="social-seguir-botones">
        <button
          type="button"
          className={siguiendo ? "social-seguir social-seguir-on" : "social-seguir"}
          onClick={() => seguirAhora(!siguiendo)}
          disabled={pendiente}
          aria-pressed={siguiendo}
        >
          {siguiendo ? <IconoSiguiendo ancho={17} /> : <IconoSeguir ancho={17} />}
          {siguiendo ? "Siguiendo" : "Seguir"}
        </button>

        {/* La campana es un interruptor aparte: seguir es "quiero verlo cuando
            entre", la campana es "avísame". Mezclarlas obligaría a elegir entre
            no seguir a nadie o recibir aviso de todos. */}
        <button
          type="button"
          className={conAlerta ? "social-campana social-campana-on" : "social-campana"}
          onClick={() => alertaAhora(!conAlerta)}
          disabled={pendiente}
          aria-pressed={conAlerta}
          title={
            conAlerta
              ? `No avisarme de las historias de ${nombre}`
              : `Avisarme cuando ${nombre} publique una historia`
          }
        >
          <span className="hueso-oculto">
            {conAlerta
              ? `No avisarme de las historias de ${nombre}`
              : `Avisarme cuando ${nombre} publique una historia`}
          </span>
          {conAlerta ? <IconoCampana ancho={18} relleno /> : <IconoCampanaTachada ancho={18} />}
        </button>
      </span>

      <AvisoPuerta aviso={aviso} volverA={volverA} alCerrar={limpiar} />
    </>
  );
}
