"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { publicar } from "./actions";
import {
  MAX_TEXTO_POST,
  TIPOS,
  esVideo,
  revisarMedia,
} from "../../../lib/social";
import { IconoCamara, IconoDestello, IconoVideo } from "../../_social/iconos";

const inicial = { status: "idle", message: "" };

// El formulario de publicar.
//
// Tres decisiones y ya: qué es (historia o publicación), qué se sube y dónde
// sale. El orden importa: primero el tipo, porque cambia lo que la pieza va a
// hacer —una dura un día y la otra se queda—, y eso conviene saberlo antes de
// elegir la foto.
export default function Nuevo({ restaurantes }) {
  const entrada = useRef(null);
  const [tipo, setTipo] = useState("historia");
  const [vista, setVista] = useState(null);
  const [texto, setTexto] = useState("");
  const [elegidos, setElegidos] = useState(() =>
    // Con un solo restaurante no hay nada que elegir: viene marcado y las
    // casillas ni se enseñan.
    restaurantes.length === 1 ? [restaurantes[0].id] : [],
  );
  const [avisoLocal, setAvisoLocal] = useState("");

  const [state, action, pending] = useActionState(async (prev, formData) => {
    const archivo = formData.get("media");
    // Se revisa aquí antes de mandar: un archivo de más de 10 MB reventaría la
    // petición entera y con ella la página, borrando lo que llevara escrito.
    const aviso = revisarMedia(archivo);
    if (aviso) return { status: "error", message: aviso };

    try {
      const resultado = await publicar(prev, formData);
      if (resultado.status === "ok") {
        // Vaciar el formulario tras publicar evita mandar dos veces lo mismo.
        if (entrada.current) entrada.current.value = "";
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

  // La vista previa se hace con una URL de objeto, que hay que soltar: sin
  // esto, elegir diez archivos seguidos deja diez en memoria.
  useEffect(() => {
    return () => {
      if (vista?.url) URL.revokeObjectURL(vista.url);
    };
  }, [vista]);

  function elegirArchivo(e) {
    const archivo = e.target.files?.[0];
    setAvisoLocal("");
    if (!archivo) {
      setVista(null);
      return;
    }

    const aviso = revisarMedia(archivo);
    if (aviso) {
      setAvisoLocal(aviso);
      setVista(null);
      e.target.value = "";
      return;
    }

    setVista({ url: URL.createObjectURL(archivo), mime: archivo.type, nombre: archivo.name });
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

  return (
    <form className="post-form" action={action}>
      <fieldset className="post-tipos">
        <legend className="sub">¿Qué vas a publicar?</legend>
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
              <span>{t.pista}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="post-campo">
        <label className="sub" htmlFor="post-media">
          Foto o video
        </label>
        <p className="ayuda">
          JPG, PNG o WebP; MP4, WebM o MOV. Hasta 10 MB. En vertical se ve mejor
          como historia.
        </p>
        <input
          ref={entrada}
          id="post-media"
          type="file"
          name="media"
          accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
          onChange={elegirArchivo}
          required
        />
        {avisoLocal ? <p className="form-msg err">{avisoLocal}</p> : null}
      </div>

      {/* La vista previa antes de publicar: es lo que separa "creo que subí la
          buena" de saberlo. Se ve con el mismo recorte que va a tener en la
          ficha. */}
      {vista ? (
        <div className="post-vista">
          <span className="post-vista-etiqueta">
            {esVideo(vista.mime) ? <IconoVideo ancho={16} /> : <IconoCamara ancho={16} />}
            Así se va a ver
          </span>
          <figure className={tipo === "historia" ? "post-vista-media es-historia" : "post-vista-media"}>
            {esVideo(vista.mime) ? (
              <video src={vista.url} controls playsInline preload="metadata" />
            ) : (
              <img src={vista.url} alt="Vista previa de lo que vas a publicar" />
            )}
          </figure>
          {texto ? <p className="post-vista-texto">{texto}</p> : null}
        </div>
      ) : null}

      <div className="post-campo">
        <label className="sub" htmlFor="post-body">
          Texto <span className="post-opcional">(opcional)</span>
        </label>
        <textarea
          id="post-body"
          name="body"
          rows={3}
          maxLength={MAX_TEXTO_POST}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Brisket recién salido del ahumador. ¿Quién se apunta?"
        />
        <span className="post-contador">
          {texto.length} / {MAX_TEXTO_POST}
        </span>
      </div>

      {/* Con varios restaurantes, las casillas. Con uno solo no se enseñan: una
          casilla que no se puede desmarcar es una pregunta sin respuestas. */}
      {restaurantes.length > 1 ? (
        <fieldset className="post-donde">
          <legend className="sub">¿Dónde se publica?</legend>

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
                    {r.status !== "publicado" ? (
                      <em className="estado">Borrador</em>
                    ) : null}
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
        </fieldset>
      ) : (
        <input type="hidden" name="restaurantes" value={restaurantes[0]?.id ?? ""} />
      )}

      {state.message ? (
        <p className={state.status === "ok" ? "form-msg ok" : "form-msg err"} role="status">
          {state.message}
        </p>
      ) : null}

      <button className="btn" type="submit" disabled={pending || !elegidos.length}>
        {pending
          ? "Publicando…"
          : tipo === "historia"
            ? "Publicar historia"
            : "Publicar"}
      </button>

      {!elegidos.length && restaurantes.length > 1 ? (
        <p className="ayuda">Elige al menos un restaurante.</p>
      ) : null}
    </form>
  );
}
