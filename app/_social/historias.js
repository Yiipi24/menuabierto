"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marcarVista } from "./actions";
import { usePuerta, AvisoPuerta } from "./puerta";
import { conteo, esVideo, hace, leQueda } from "../../lib/social";
import {
  IconoCerrar,
  IconoChevronDer,
  IconoChevronIzq,
  IconoDestello,
  IconoOjo,
  IconoPausa,
  IconoReproducir,
} from "./iconos";

// El carrusel de historias y su visor.
//
// Van en el mismo archivo porque son una sola cosa: el círculo es la portada de
// la historia y el visor es la historia abierta. Separarlos obligaría a subir
// el estado de "cuál está abierta" a un tercero que no pinta nada.

const DURACION = 6000; // Lo que dura una foto en pantalla, en milisegundos.

// `titulo` es lo que encabeza la tira. En una ficha es "Historias", porque ya
// se sabe de quién son; en el feed del comensal es el nombre del restaurante,
// que es lo que distingue una tira de la siguiente.
export default function Historias({ historias, nombre, volverA, titulo = "Historias" }) {
  const [abierta, setAbierta] = useState(null);
  const [vistas, setVistas] = useState(() => new Set(historias.filter((h) => h.vista).map((h) => h.id)));
  const tira = useRef(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);
  const { aviso, limpiar } = usePuerta(volverA);

  // Los chevrons solo aparecen si hay a dónde ir. Con cinco historias en una
  // pantalla de escritorio caben todas y dos flechas muertas serían ruido.
  const revisarBordes = useCallback(() => {
    const el = tira.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 4);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    revisarBordes();
    const el = tira.current;
    if (!el) return undefined;
    el.addEventListener("scroll", revisarBordes, { passive: true });
    window.addEventListener("resize", revisarBordes);
    return () => {
      el.removeEventListener("scroll", revisarBordes);
      window.removeEventListener("resize", revisarBordes);
    };
  }, [revisarBordes]);

  function correr(hacia) {
    const el = tira.current;
    if (!el) return;
    el.scrollBy({ left: hacia * Math.max(el.clientWidth * 0.8, 200), behavior: "smooth" });
  }

  const abrir = useCallback(
    (indice) => {
      setAbierta(indice);
    },
    [],
  );

  // La visualización se apunta al abrir cada historia. Falla en silencio: el
  // conteo nunca vale interrumpir a quien está mirando, y a quien no ha entrado
  // se le pide la cuenta solo si intenta algo más.
  const anotarVista = useCallback(
    async (id) => {
      if (!id || vistas.has(id)) return;
      setVistas((previas) => new Set(previas).add(id));
      const r = await marcarVista(id);
      if (!r.ok && r.motivo === "sesion") {
        // No se molesta a nadie con un cartel por mirar; solo se deshace la
        // marca para que el anillo siga diciendo la verdad.
        setVistas((previas) => {
          const copia = new Set(previas);
          copia.delete(id);
          return copia;
        });
      }
    },
    [vistas],
  );

  if (!historias.length) return null;

  return (
    <section className="historias" aria-label={`Historias de ${nombre}`}>
      <div className="historias-cabeza">
        <h2>{titulo}</h2>
        <div className="historias-flechas">
          <button
            type="button"
            className="historias-flecha"
            onClick={() => correr(-1)}
            disabled={!puedeIzq}
            aria-label="Ver historias anteriores"
          >
            <IconoChevronIzq ancho={20} />
          </button>
          <button
            type="button"
            className="historias-flecha"
            onClick={() => correr(1)}
            disabled={!puedeDer}
            aria-label="Ver más historias"
          >
            <IconoChevronDer ancho={20} />
          </button>
        </div>
      </div>

      <ul className="historias-tira" ref={tira}>
        {historias.map((h, i) => {
          const nueva = !vistas.has(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                className={nueva ? "historia-circulo historia-nueva" : "historia-circulo"}
                onClick={() => abrir(i)}
              >
                <span className="historia-anillo">
                  {esVideo(h.media_mime) ? (
                    // El póster del video: el primer fotograma, sin descargarlo
                    // entero. `preload="metadata"` baja unos kilobytes en vez de
                    // los diez megas del archivo.
                    <video src={h.url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={h.url} alt="" loading="lazy" />
                  )}
                </span>
                <span className="historia-nombre">{h.titulo ?? tituloDe(h, i)}</span>
                {nueva ? (
                  <span className="historia-marca" aria-hidden="true">
                    <IconoDestello ancho={12} />
                    Nuevo
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <AvisoPuerta aviso={aviso} volverA={volverA} alCerrar={limpiar} />

      {abierta !== null ? (
        <Visor
          historias={historias}
          inicio={abierta}
          nombre={nombre}
          alCerrar={() => setAbierta(null)}
          alVer={anotarVista}
        />
      ) : null}
    </section>
  );
}

// El pie de cada círculo. Si la historia trae texto se usan sus primeras
// palabras; si no, su edad: "Hace 2 h" dice más que "Historia 3".
function tituloDe(h, i) {
  const texto = String(h.body ?? "").trim();
  if (texto) {
    const corto = texto.split(/\s+/).slice(0, 3).join(" ");
    return corto.length > 18 ? `${corto.slice(0, 18)}…` : corto;
  }
  return hace(h.created_at);
}

// ---------------------------------------------------------------------------
// El visor
// ---------------------------------------------------------------------------
// Avanza solo, se pausa al mantener pulsado, se mueve con las flechas del
// teclado y se cierra con Escape. Las barras de arriba dicen cuántas hay y en
// cuál va, que es lo que hace que no se sienta un carrusel infinito.

function Visor({ historias, inicio, nombre, alCerrar, alVer }) {
  const [i, setI] = useState(inicio);
  const [pausado, setPausado] = useState(false);
  const [avance, setAvance] = useState(0);
  const video = useRef(null);
  const cerrar = useRef(null);

  const actual = historias[i];
  const esVid = actual ? esVideo(actual.media_mime) : false;

  // Cada historia que se abre cuenta como vista, también las que se llegan
  // avanzando: son historias vistas igual que la primera.
  useEffect(() => {
    if (actual) alVer(actual.id);
    setAvance(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const siguiente = useCallback(() => {
    setI((n) => {
      if (n + 1 >= historias.length) {
        alCerrar();
        return n;
      }
      return n + 1;
    });
  }, [historias.length, alCerrar]);

  const anterior = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // El avance de las fotos lo lleva un intervalo; el de los videos, el propio
  // video, que sabe cuánto dura. Un video de treinta segundos cortado a los
  // seis sería una historia a medias.
  useEffect(() => {
    if (pausado || esVid) return undefined;
    const paso = 50;
    const id = setInterval(() => {
      setAvance((a) => {
        const nuevo = a + (paso / DURACION) * 100;
        if (nuevo >= 100) {
          siguiente();
          return 0;
        }
        return nuevo;
      });
    }, paso);
    return () => clearInterval(id);
  }, [pausado, esVid, siguiente]);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (pausado) el.pause();
    else el.play().catch(() => {});
  }, [pausado, i]);

  // Teclado: es un diálogo, así que Escape lo cierra y las flechas lo mueven.
  useEffect(() => {
    function tecla(e) {
      if (e.key === "Escape") alCerrar();
      else if (e.key === "ArrowRight") siguiente();
      else if (e.key === "ArrowLeft") anterior();
      else if (e.key === " ") {
        e.preventDefault();
        setPausado((p) => !p);
      }
    }
    document.addEventListener("keydown", tecla);
    // El foco entra al visor al abrirlo: sin esto, el teclado se queda en la
    // página de atrás y el lector de pantalla sigue leyendo la ficha.
    cerrar.current?.focus();
    // La página de atrás no debe moverse mientras el visor está encima.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [alCerrar, siguiente, anterior]);

  if (!actual) return null;

  return (
    <div
      className="visor"
      role="dialog"
      aria-modal="true"
      aria-label={`Historias de ${nombre}`}
    >
      {/* El fondo cierra: es lo que se espera de una capa oscura, y en un
          teléfono es el gesto más fácil de acertar. */}
      <button type="button" className="visor-fondo" onClick={alCerrar} tabIndex={-1}>
        <span className="hueso-oculto">Cerrar</span>
      </button>

      <div className="visor-caja">
        <div className="visor-barras" aria-hidden="true">
          {historias.map((h, n) => (
            <span key={h.id} className="visor-barra">
              <span
                className="visor-barra-llena"
                style={{ width: n < i ? "100%" : n === i ? `${avance}%` : "0%" }}
              />
            </span>
          ))}
        </div>

        <header className="visor-cabeza">
          <span className="visor-quien">
            <strong>{nombre}</strong>
            <span>
              {hace(actual.created_at)} · {leQueda(actual.expires_at)}
            </span>
          </span>

          <span className="visor-acciones">
            <button
              type="button"
              className="visor-boton"
              onClick={() => setPausado((p) => !p)}
              aria-label={pausado ? "Reanudar" : "Pausar"}
            >
              {pausado ? <IconoReproducir ancho={18} /> : <IconoPausa ancho={18} />}
            </button>
            <button
              type="button"
              className="visor-boton"
              onClick={alCerrar}
              ref={cerrar}
              aria-label="Cerrar historias"
            >
              <IconoCerrar ancho={20} />
            </button>
          </span>
        </header>

        <div className="visor-media">
          {esVid ? (
            <video
              ref={video}
              src={actual.url}
              autoPlay
              playsInline
              controls={false}
              onEnded={siguiente}
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                if (el.duration) setAvance((el.currentTime / el.duration) * 100);
              }}
            />
          ) : (
            <img src={actual.url} alt={actual.body || `Historia de ${nombre}`} />
          )}

          {/* Las dos mitades invisibles: tocar a la izquierda regresa, a la
              derecha avanza. Es el gesto que ya conoce cualquiera que haya
              abierto una historia en otro sitio. */}
          <button
            type="button"
            className="visor-zona visor-zona-izq"
            onClick={anterior}
            aria-label="Historia anterior"
          />
          <button
            type="button"
            className="visor-zona visor-zona-der"
            onClick={siguiente}
            aria-label="Historia siguiente"
          />
        </div>

        <footer className="visor-pie">
          {actual.body ? <p className="visor-texto">{actual.body}</p> : null}
          {/* El conteo es del dueño y de quien mira por igual: en una historia
              que dura un día, saber que la vieron doscientos es la mitad de la
              gracia. */}
          <span className="visor-vistas">
            <IconoOjo ancho={17} />
            {conteo(actual.views_count)} {actual.views_count === 1 ? "vista" : "vistas"}
          </span>
        </footer>
      </div>
    </div>
  );
}
