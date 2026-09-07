"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { publicar } from "./actions";
import { MAX_TEXTO_POST, TIPOS, esVideo, revisarMedia } from "../../../lib/social";
import {
  ESTADO,
  avisoSinIntegracion,
  estadoInicialDeRedes,
  integracionLista,
  textoDeEstado,
} from "../../../lib/redes-publicacion";
import { IconoRed } from "../../redes-iconos";
import {
  IconoAvion,
  IconoAyuda,
  IconoCamara,
  IconoCerrar,
  IconoCorazon,
  IconoDestello,
  IconoFoco,
  IconoGirar,
  IconoImagen,
  IconoNube,
  IconoPalomita,
  IconoVideo,
} from "../../_social/iconos";

const inicial = { status: "idle", message: "" };

const ACEPTA = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime";

const CONSEJOS = [
  "Usa fotos y videos en formato vertical (9:16).",
  "Muestra tus platillos, ambiente o promociones.",
  "Mantén el texto corto y llamativo.",
  "La luz natural hace una gran diferencia.",
];

// El formulario de publicar, por pasos.
//
// Sigue siendo el mismo trato de siempre —qué es, qué se sube, qué dice y dónde
// sale—, pero ahora cada decisión ocupa su propio paso numerado y lo que se va
// armando se ve a la derecha, en un teléfono, antes de mandarlo. Ver la historia
// como la va a ver quien la abra es lo que separa "creo que quedó bien" de
// saberlo.
export default function Nuevo({ restaurantes, conexiones = [] }) {
  const entrada = useRef(null);
  const [tipo, setTipo] = useState("historia");
  const [fuente, setFuente] = useState("foto");
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [texto, setTexto] = useState("");
  const [avisoLocal, setAvisoLocal] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [vistaMovil, setVistaMovil] = useState(false);
  const [redes, setRedes] = useState(() => estadoInicialDeRedes(conexiones));
  const [elegidos, setElegidos] = useState(() =>
    // Con un solo restaurante no hay nada que elegir: viene marcado y las
    // casillas ni se enseñan.
    restaurantes.length === 1 ? [restaurantes[0].id] : [],
  );

  // La vista previa se hace con una URL de objeto, que hay que soltar: sin
  // esto, elegir diez archivos seguidos deja diez en memoria.
  useEffect(() => {
    return () => {
      if (vista?.url) URL.revokeObjectURL(vista.url);
    };
  }, [vista]);

  const [state, action, pending] = useActionState(async (prev, formData) => {
    // El archivo viaja en el estado y no en el input: la cámara también produce
    // archivos, y un solo sitio del que salga lo que se manda evita publicar la
    // foto vieja cuando se acaba de grabar un video.
    const aviso = revisarMedia(archivo);
    if (aviso) return { status: "error", message: aviso };
    formData.set("media", archivo, archivo.name);

    try {
      const resultado = await publicar(prev, formData);
      if (resultado.status === "ok") {
        // Vaciar el formulario tras publicar evita mandar dos veces lo mismo.
        if (entrada.current) entrada.current.value = "";
        setArchivo(null);
        setVista(null);
        setTexto("");
      }
      return resultado;
    } catch (error) {
      // Cualquier fallo de la subida se queda aquí: dejarlo subir llevaría a
      // la pantalla de error y a perder el resto del formulario.
      console.error("publicar", error);
      return {
        status: "error",
        message: "No pudimos publicar. Revisa tu conexión e inténtalo otra vez.",
      };
    }
  }, inicial);

  // Lo que acepta un archivo, venga del disco o de la cámara. Devuelve el aviso
  // si no pasa, para que quien llama sepa que no cambió nada.
  const tomarArchivo = useCallback((file) => {
    const aviso = revisarMedia(file);
    if (aviso) {
      setAvisoLocal(aviso);
      return aviso;
    }
    setAvisoLocal("");
    setArchivo(file);
    setVista({ url: URL.createObjectURL(file), mime: file.type, nombre: file.name, size: file.size });
    return null;
  }, []);

  function elegirArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (tomarArchivo(file)) e.target.value = "";
  }

  function quitarArchivo() {
    if (entrada.current) entrada.current.value = "";
    setArchivo(null);
    setVista(null);
    setAvisoLocal("");
  }

  function soltar(e) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) tomarArchivo(file);
  }

  const todos = restaurantes.length > 0 && elegidos.length === restaurantes.length;

  function alternarTodos() {
    setElegidos(todos ? [] : restaurantes.map((r) => r.id));
  }

  function alternarUno(id) {
    setElegidos((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id],
    );
  }

  // El interruptor de una red solo se mueve si la red está conectada de verdad.
  function alternarRed(slug) {
    setRedes((previas) =>
      previas.map((r) =>
        r.slug === slug && r.estado === ESTADO.CONECTADA ? { ...r, activa: !r.activa } : r,
      ),
    );
  }

  function conectarRed(slug, nombre) {
    setRedes((previas) =>
      previas.map((r) =>
        r.slug === slug
          ? {
              ...r,
              // Sin integración no hay a dónde mandar a nadie: en vez de abrir
              // un OAuth que no existe, se dice qué falta.
              mensaje: integracionLista(slug) ? "" : avisoSinIntegracion(nombre),
            }
          : r,
      ),
    );
  }

  const listo = Boolean(archivo) && elegidos.length > 0;
  const nombreRestaurante =
    restaurantes.find((r) => r.id === elegidos[0])?.name ?? restaurantes[0]?.name ?? "Tu restaurante";

  const previa = (
    <VistaPrevia
      tipo={tipo}
      cambiarTipo={setTipo}
      vista={vista}
      texto={texto}
      restaurante={nombreRestaurante}
    />
  );

  return (
    <div className="post-layout">
      <form className="post-form" action={action} noValidate>
        {/* 1. Qué se publica */}
        <Paso numero={1} titulo="¿Qué vas a publicar?">
          <fieldset className="post-tipos">
            <legend className="sr-only">Tipo de contenido</legend>
            {Object.values(TIPOS).map((t) => (
              <label
                key={t.slug}
                className={tipo === t.slug ? "post-tipo elegido" : "post-tipo"}
              >
                <input
                  type="radio"
                  name="kind"
                  value={t.slug}
                  checked={tipo === t.slug}
                  onChange={() => setTipo(t.slug)}
                />
                <span className="post-tipo-icono" aria-hidden="true">
                  {t.slug === "historia" ? <IconoDestello ancho={20} /> : <IconoCamara ancho={20} />}
                </span>
                <span className="post-tipo-texto">
                  <strong>{t.nombre}</strong>
                  <span>
                    {t.slug === "historia"
                      ? "Dura 24 horas y desaparece sola."
                      : "Permanece en tu ficha hasta que la borres."}
                  </span>
                  <span>
                    {t.slug === "historia"
                      ? "Ideal para promociones del día, eventos y contenido temporal."
                      : "Ideal para platillos, noticias y anuncios."}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </Paso>

        {/* 2. El archivo: del disco o de la cámara */}
        <Paso numero={2} titulo="Contenido" pista="Elige cómo quieres agregar tu contenido.">
          <div className="post-fuentes" role="group" aria-label="Cómo agregar tu contenido">
            <Fuente
              activa={fuente === "foto"}
              onClick={() => setFuente("foto")}
              icono={<IconoImagen ancho={26} />}
              titulo="Subir foto"
              pista="Desde tu dispositivo"
            />
            <Fuente
              activa={fuente === "video"}
              onClick={() => setFuente("video")}
              icono={<IconoVideo ancho={26} />}
              titulo="Subir video"
              pista="Desde tu dispositivo"
            />
            <Fuente
              activa={fuente === "camara"}
              onClick={() => setFuente("camara")}
              icono={<IconoCamara ancho={26} />}
              titulo="Usar cámara"
              pista="Tomar foto o grabar video"
            />
          </div>

          <input
            ref={entrada}
            id="post-media"
            className="sr-only"
            type="file"
            accept={fuente === "video" ? "video/mp4,video/webm,video/quicktime" : ACEPTA}
            onChange={elegirArchivo}
          />

          {fuente === "camara" ? (
            <div className="post-camara-fila">
              <Camara onCaptura={tomarArchivo} vista={vista} onRepetir={quitarArchivo} />
              <div className="post-camara-aparte">
                <p className="ayuda">O si prefieres, sube un archivo</p>
                <Soltadero
                  compacto
                  arrastrando={arrastrando}
                  setArrastrando={setArrastrando}
                  soltar={soltar}
                  abrir={() => entrada.current?.click()}
                />
                <p className="ayuda">
                  JPG, PNG o WebP; MP4, WebM o MOV. Hasta 10 MB. En vertical se ve mejor como
                  historia.
                </p>
              </div>
            </div>
          ) : vista ? (
            <ArchivoElegido vista={vista} onQuitar={quitarArchivo} onCambiar={() => entrada.current?.click()} />
          ) : (
            <>
              <Soltadero
                arrastrando={arrastrando}
                setArrastrando={setArrastrando}
                soltar={soltar}
                abrir={() => entrada.current?.click()}
                etiqueta={fuente === "video" ? "Arrastra y suelta tu video aquí" : "Arrastra y suelta tu foto aquí"}
              />
              <p className="ayuda">
                JPG, PNG o WebP; MP4, WebM o MOV. Hasta 10 MB. En vertical se ve mejor como
                historia.
              </p>
            </>
          )}

          {avisoLocal ? (
            <p className="form-msg err" role="alert">
              {avisoLocal}
            </p>
          ) : null}
        </Paso>

        {/* 3. El texto */}
        <Paso
          numero={3}
          titulo={
            <>
              Texto <span className="post-opcional">(opcional)</span>
            </>
          }
          htmlFor="post-body"
        >
          <textarea
            id="post-body"
            name="body"
            className="post-texto"
            rows={3}
            maxLength={MAX_TEXTO_POST}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Brisket recién salido del ahumador. ¿Quién se apunta?"
            aria-describedby="post-contador"
          />
          <span className="post-contador" id="post-contador">
            {texto.length}/{MAX_TEXTO_POST}
          </span>
        </Paso>

        {/* 4. Las redes de fuera */}
        <Paso
          numero={4}
          titulo="Publicar también en redes sociales"
          pista="Conecta tus cuentas para compartir automáticamente."
        >
          <ul className="post-redes">
            {redes.map((red) => (
              <li
                key={red.slug}
                className={red.estado === ESTADO.CONECTADA ? "post-red conectada" : "post-red"}
              >
                <span className={`post-red-logo es-${red.slug}`} aria-hidden="true">
                  <IconoRed slug={red.slug} ancho={22} />
                </span>
                <span className="post-red-texto">
                  <strong>{red.nombre}</strong>
                  <span
                    className={
                      red.estado === ESTADO.CONECTADA ? "post-red-estado es-viva" : "post-red-estado"
                    }
                  >
                    {textoDeEstado(red.estado, red.nombre)}
                  </span>
                </span>

                {red.estado === ESTADO.CONECTADA ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={red.activa}
                    aria-label={`Publicar también en ${red.nombre}`}
                    className={red.activa ? "switch encendido" : "switch"}
                    onClick={() => alternarRed(red.slug)}
                  >
                    <span className="switch-bolita" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-linea btn-sm post-red-conectar"
                    onClick={() => conectarRed(red.slug, red.nombre)}
                  >
                    Conectar
                  </button>
                )}

                {red.mensaje ? (
                  <p className="post-red-aviso" role="status">
                    {red.mensaje}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Paso>

        {/* 5. Dónde. Con un solo restaurante no hay paso que dar. */}
        {restaurantes.length > 1 ? (
          <Paso numero={5} titulo="¿Dónde se publica?">
            <fieldset className="post-donde">
              <legend className="sr-only">Restaurantes</legend>

              <label className="post-todos">
                <input
                  type="checkbox"
                  checked={todos}
                  onChange={alternarTodos}
                  // Ni marcado ni vacío cuando hay algunos: es el estado real.
                  ref={(el) => {
                    if (el) el.indeterminate = elegidos.length > 0 && !todos;
                  }}
                />
                <span>Seleccionar todos</span>
              </label>

              <ul className="post-restaurantes">
                {restaurantes.map((r) => (
                  <li key={r.id}>
                    <label>
                      <input
                        type="checkbox"
                        name="restaurantes"
                        value={r.id}
                        checked={elegidos.includes(r.id)}
                        onChange={() => alternarUno(r.id)}
                      />
                      <span className="post-restaurante-nombre">
                        {r.name}
                        {r.status !== "publicado" ? <em className="estado">Borrador</em> : null}
                      </span>
                      {r.neighborhood || r.city ? (
                        <span className="post-restaurante-lugar">
                          {[r.neighborhood, r.city].filter(Boolean).join(", ")}
                        </span>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
              {!elegidos.length ? (
                <p className="form-msg err">Elige al menos un restaurante.</p>
              ) : null}
            </fieldset>
          </Paso>
        ) : (
          <input type="hidden" name="restaurantes" value={restaurantes[0]?.id ?? ""} />
        )}

        {state.message ? (
          <p
            className={state.status === "ok" ? "form-msg ok" : "form-msg err"}
            role="status"
            aria-live="polite"
          >
            {state.status === "ok" ? <IconoPalomita ancho={16} /> : null} {state.message}
          </p>
        ) : null}

        {/* La vista previa en móvil va debajo del formulario, detrás de un
            botón: en una pantalla angosta, meterla antes del botón de publicar
            deja el botón a dos pantallas de distancia. */}
        <div className="post-vista-movil">
          <button
            type="button"
            className="btn-linea"
            onClick={() => setVistaMovil((v) => !v)}
            aria-expanded={vistaMovil}
          >
            {vistaMovil ? "Ocultar vista previa" : "Vista previa"}
          </button>
          {vistaMovil ? previa : null}
        </div>

        <div className="post-barra">
          <a className="btn-linea" href="/panel">
            Cancelar
          </a>
          <button className="btn btn-grande" type="submit" disabled={pending || !listo}>
            <IconoAvion ancho={18} />
            {pending ? "Publicando…" : tipo === "historia" ? "Publicar historia" : "Publicar"}
          </button>
        </div>

        {!listo && !pending ? (
          <p className="ayuda post-barra-ayuda">
            {!archivo
              ? "Agrega una foto o un video para poder publicar."
              : "Elige al menos un restaurante."}
          </p>
        ) : null}
      </form>

      <aside className="post-aparte">
        {previa}

        <section className="post-tips">
          <h2>
            <span aria-hidden="true">
              <IconoFoco ancho={18} />
            </span>
            Tips para mejores resultados
          </h2>
          <ul>
            {CONSEJOS.map((c) => (
              <li key={c}>
                <IconoPalomita ancho={15} />
                {c}
              </li>
            ))}
          </ul>
        </section>

        <details className="post-ayuda" open={ayuda} onToggle={(e) => setAyuda(e.target.open)}>
          <summary>
            <IconoAyuda ancho={17} />
            ¿Necesitas ayuda?
          </summary>
          <p>
            Una historia dura 24 horas y sirve para lo de hoy. Una publicación se queda en tu ficha
            hasta que la borres. Puedes cambiar el texto después de publicar; el archivo no, para no
            dejar los Me gusta apuntando a otra cosa.
          </p>
        </details>
      </aside>
    </div>
  );
}

// Cada paso: el número en su círculo, el título y lo que haya debajo.
function Paso({ numero, titulo, pista, htmlFor, children }) {
  const Titulo = htmlFor ? "label" : "h2";
  return (
    <section className="post-paso">
      <span className="post-paso-numero" aria-hidden="true">
        {numero}
      </span>
      <div className="post-paso-cuerpo">
        <Titulo className="post-paso-titulo" htmlFor={htmlFor}>
          {titulo}
        </Titulo>
        {pista ? <p className="post-paso-pista">{pista}</p> : null}
        {children}
      </div>
    </section>
  );
}

function Fuente({ activa, onClick, icono, titulo, pista }) {
  return (
    <button
      type="button"
      className={activa ? "post-fuente elegida" : "post-fuente"}
      onClick={onClick}
      aria-pressed={activa}
    >
      <span className="post-fuente-icono" aria-hidden="true">
        {icono}
      </span>
      <span className="post-fuente-texto">
        <strong>{titulo}</strong>
        <span>{pista}</span>
      </span>
    </button>
  );
}

// El área de arrastrar y soltar. En móvil el arrastre no existe, así que lo que
// manda es el botón: por eso el área entera también es el botón.
function Soltadero({ arrastrando, setArrastrando, soltar, abrir, compacto, etiqueta }) {
  return (
    <div
      className={[
        "post-soltadero",
        compacto ? "es-compacto" : "",
        arrastrando ? "arrastrando" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={soltar}
    >
      <span className="post-soltadero-icono" aria-hidden="true">
        <IconoNube ancho={30} />
      </span>
      <p>{etiqueta ?? "Arrastra y suelta tu archivo aquí"}</p>
      <span className="post-soltadero-o">o</span>
      <button type="button" className="btn-linea btn-sm" onClick={abrir}>
        Seleccionar archivo
      </button>
    </div>
  );
}

function pesa(bytes) {
  const mb = (Number(bytes) || 0) / (1024 * 1024);
  return mb < 1 ? `${Math.max(1, Math.round(mb * 1024))} KB` : `${mb.toFixed(1)} MB`;
}

function ArchivoElegido({ vista, onQuitar, onCambiar }) {
  return (
    <div className="post-archivo">
      <figure className="post-archivo-media">
        {esVideo(vista.mime) ? (
          <video src={vista.url} muted playsInline preload="metadata" />
        ) : (
          <img src={vista.url} alt="" />
        )}
      </figure>
      <div className="post-archivo-datos">
        <strong>{vista.nombre}</strong>
        <span>
          {esVideo(vista.mime) ? "Video" : "Foto"} · {pesa(vista.size)}
        </span>
        <div className="post-archivo-acciones">
          <button type="button" className="btn-texto" onClick={onCambiar}>
            Reemplazar
          </button>
          <button type="button" className="btn-texto es-peligro" onClick={onQuitar}>
            Quitar
          </button>
        </div>
      </div>
    </div>
  );
}

// La cámara del dispositivo. Foto o video, sin salir de la página.
function Camara({ onCaptura, vista, onRepetir }) {
  const video = useRef(null);
  const stream = useRef(null);
  const grabadora = useRef(null);
  const trozos = useRef([]);
  const [modo, setModo] = useState("foto");
  const [frontal, setFrontal] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [fallo, setFallo] = useState("");

  const hayCamara =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  // El permiso se pide al abrir la cámara y no al cargar la página: preguntarlo
  // antes de que nadie lo haya pedido es la forma más rápida de que lo nieguen.
  useEffect(() => {
    if (!hayCamara || vista) return undefined;
    let vivo = true;

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: frontal ? "user" : "environment" },
          audio: true,
        });
        if (!vivo) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        setFallo("");
      } catch (error) {
        console.error("camara", error);
        setFallo(
          "No pudimos usar la cámara. Revisa el permiso del navegador o sube un archivo desde tu dispositivo.",
        );
      }
    })();

    return () => {
      vivo = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [frontal, hayCamara, vista]);

  function tomarFoto() {
    const el = video.current;
    if (!el) return;
    const lienzo = document.createElement("canvas");
    lienzo.width = el.videoWidth || 720;
    lienzo.height = el.videoHeight || 1280;
    lienzo.getContext("2d").drawImage(el, 0, 0, lienzo.width, lienzo.height);
    lienzo.toBlob(
      (blob) => {
        if (!blob) return;
        onCaptura(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  function grabar() {
    if (!stream.current) return;
    // El contenedor lo decide el navegador: Safari no graba WebM y Chrome no
    // graba MP4, y los dos formatos ya los acepta el servidor.
    const tipo = ["video/webm", "video/mp4"].find(
      (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
    );
    if (!tipo) {
      setFallo("Tu navegador no puede grabar video aquí. Graba con la app de cámara y súbelo.");
      return;
    }

    trozos.current = [];
    const rec = new MediaRecorder(stream.current, { mimeType: tipo });
    rec.ondataavailable = (e) => {
      if (e.data.size) trozos.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(trozos.current, { type: tipo });
      const ext = tipo.includes("mp4") ? "mp4" : "webm";
      onCaptura(new File([blob], `video-${Date.now()}.${ext}`, { type: tipo }));
    };
    grabadora.current = rec;
    rec.start();
    setGrabando(true);
  }

  function parar() {
    grabadora.current?.stop();
    grabadora.current = null;
    setGrabando(false);
  }

  if (vista) {
    return (
      <div className="post-camara">
        <figure className="post-camara-lente">
          {esVideo(vista.mime) ? (
            <video src={vista.url} controls playsInline />
          ) : (
            <img src={vista.url} alt="Lo que acabas de capturar" />
          )}
        </figure>
        <div className="post-camara-pie">
          <button type="button" className="btn-linea btn-sm" onClick={onRepetir}>
            Repetir
          </button>
        </div>
      </div>
    );
  }

  if (!hayCamara) {
    return (
      <div className="post-camara">
        <p className="form-msg err">
          Este navegador no permite usar la cámara desde la página. Sube una foto o un video desde
          tu dispositivo.
        </p>
      </div>
    );
  }

  return (
    <div className="post-camara">
      <div className="post-camara-tabs" role="group" aria-label="Qué quieres capturar">
        <button
          type="button"
          className={modo === "foto" ? "post-tab activa" : "post-tab"}
          onClick={() => setModo("foto")}
          aria-pressed={modo === "foto"}
          disabled={grabando}
        >
          <IconoCamara ancho={16} />
          Tomar foto
        </button>
        <button
          type="button"
          className={modo === "video" ? "post-tab activa" : "post-tab"}
          onClick={() => setModo("video")}
          aria-pressed={modo === "video"}
        >
          <IconoVideo ancho={16} />
          Grabar video
        </button>
      </div>

      <figure className="post-camara-lente">
        <video ref={video} autoPlay muted playsInline />
        <span className="post-camara-marco" aria-hidden="true" />
        <button
          type="button"
          className="post-camara-girar"
          onClick={() => setFrontal((f) => !f)}
          disabled={grabando}
        >
          <IconoGirar ancho={20} />
          <span>Cambiar cámara</span>
        </button>
        {modo === "foto" ? (
          <button
            type="button"
            className="post-camara-disparo"
            onClick={tomarFoto}
            aria-label="Tomar foto"
          />
        ) : (
          <button
            type="button"
            className={grabando ? "post-camara-disparo grabando" : "post-camara-disparo"}
            onClick={grabando ? parar : grabar}
            aria-label={grabando ? "Detener la grabación" : "Grabar video"}
          />
        )}
      </figure>

      {fallo ? (
        <p className="form-msg err" role="alert">
          {fallo}
        </p>
      ) : null}
    </div>
  );
}

// Cómo se va a ver. La historia dentro de un teléfono, porque es donde se ve; la
// publicación como la tarjeta de la ficha.
function VistaPrevia({ tipo, cambiarTipo, vista, texto, restaurante }) {
  const inicialNombre = (restaurante || "M").trim().charAt(0).toUpperCase();

  return (
    <section className="post-previa" aria-label="Vista previa">
      <h2 className="post-previa-titulo">Vista previa</h2>

      <div className="post-previa-tabs" role="tablist" aria-label="Tipo de vista previa">
        {Object.values(TIPOS).map((t) => (
          <button
            key={t.slug}
            type="button"
            role="tab"
            aria-selected={tipo === t.slug}
            className={tipo === t.slug ? "post-previa-tab activa" : "post-previa-tab"}
            onClick={() => cambiarTipo(t.slug)}
          >
            {t.nombre}
          </button>
        ))}
      </div>

      {tipo === "historia" ? (
        <div className="telefono">
          <div className="telefono-pantalla">
            <span className="telefono-barra" aria-hidden="true">
              <i />
            </span>
            <span className="telefono-cabeza">
              <span className="telefono-avatar" aria-hidden="true">
                {inicialNombre}
              </span>
              <strong>{restaurante}</strong>
              <em>Ahora</em>
              <span className="telefono-cerrar" aria-hidden="true">
                <IconoCerrar ancho={18} />
              </span>
            </span>

            <div className="telefono-media">
              {vista ? (
                esVideo(vista.mime) ? (
                  <video src={vista.url} autoPlay muted loop playsInline />
                ) : (
                  <img src={vista.url} alt="" />
                )
              ) : (
                <span className="telefono-vacio">
                  <IconoImagen ancho={28} />
                  Tu foto o video se verá aquí
                </span>
              )}
            </div>

            {texto ? <p className="telefono-texto">{texto}</p> : null}

            <span className="telefono-pie" aria-hidden="true">
              <span className="telefono-campo">Send message…</span>
              <IconoCorazon ancho={20} />
            </span>
          </div>
        </div>
      ) : (
        <article className="previa-post">
          <header>
            <span className="telefono-avatar" aria-hidden="true">
              {inicialNombre}
            </span>
            <span>
              <strong>{restaurante}</strong>
              <em>Ahora</em>
            </span>
          </header>
          <div className="previa-post-media">
            {vista ? (
              esVideo(vista.mime) ? (
                <video src={vista.url} autoPlay muted loop playsInline />
              ) : (
                <img src={vista.url} alt="" />
              )
            ) : (
              <span className="telefono-vacio">
                <IconoImagen ancho={28} />
                Tu foto o video se verá aquí
              </span>
            )}
          </div>
          {texto ? <p className="previa-post-texto">{texto}</p> : null}
          <footer aria-hidden="true">
            <IconoCorazon ancho={18} /> 0<span className="previa-post-sep" />
          </footer>
        </article>
      )}

      <p className="post-previa-nota">
        Esta es una vista previa aproximada. El resultado final puede variar ligeramente.
      </p>
    </section>
  );
}
