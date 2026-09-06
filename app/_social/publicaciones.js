"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  alternarMeGusta,
  borrarComentario,
  comentar,
  comentariosDe,
  masPublicaciones,
} from "./actions";
import { usarPuerta, useAccionPendiente, AvisoPuerta } from "./puerta";
import {
  conteo,
  esVideo,
  hace,
  MAX_TEXTO_COMENTARIO,
  plural,
  POR_PAGINA,
} from "../../lib/social";
import { IconoBote, IconoComentario, IconoCorazon } from "./iconos";

// Las publicaciones: la lista de la ficha ("Novedades de …") y, con otra
// cabecera, las del feed del comensal. Es el mismo componente porque es la
// misma pieza: foto o video, texto, fecha, corazón, comentarios y el campo para
// escribir. Duplicarlo habría duplicado también el manejo del corazón y de la
// sesión, que es donde está toda la sustancia.

export default function Publicaciones({
  publicaciones,
  restauranteId = null,
  nombre,
  volverA,
  hayMas = false,
  encabezadoDeCadaUna = false,
}) {
  const [lista, setLista] = useState(publicaciones);
  const [quedan, setQuedan] = useState(hayMas);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);

  // Si el servidor vuelve a pintar la página con otras publicaciones —el dueño
  // acaba de borrar una— la lista de aquí tiene que seguirla.
  useEffect(() => {
    setLista(publicaciones);
    setQuedan(hayMas);
  }, [publicaciones, hayMas]);

  async function traerMas() {
    if (!restauranteId || cargando || !lista.length) return;
    setCargando(true);
    setFallo(false);
    const ultima = lista[lista.length - 1];
    const r = await masPublicaciones(restauranteId, ultima.created_at);
    setCargando(false);

    if (!r.ok) {
      setFallo(true);
      return;
    }
    if (!r.publicaciones.length) {
      setQuedan(false);
      return;
    }
    setLista((previas) => [...previas, ...r.publicaciones]);
    setQuedan(r.publicaciones.length >= POR_PAGINA);
  }

  if (!lista.length) return null;

  return (
    <div className="publicaciones">
      {lista.map((p) => (
        <Publicacion
          key={p.id}
          publicacion={p}
          nombre={encabezadoDeCadaUna ? p.restaurant_name : nombre}
          slug={encabezadoDeCadaUna ? p.restaurant_slug : null}
          volverA={volverA}
        />
      ))}

      {fallo ? (
        <p className="form-msg err">
          No pudimos traer más publicaciones. Inténtalo otra vez.
        </p>
      ) : null}

      {/* Se cargan a botón y no al hacer scroll: una lista que crece sola deja
          el pie de página inalcanzable, y aquí abajo están las reseñas. */}
      {quedan && restauranteId ? (
        <button
          type="button"
          className="btn-linea publicaciones-mas"
          onClick={traerMas}
          disabled={cargando}
        >
          {cargando ? "Cargando…" : "Ver más publicaciones"}
        </button>
      ) : null}
    </div>
  );
}

export function Publicacion({ publicacion, nombre, slug, volverA, alBorrar = null }) {
  const [meGusta, setMeGusta] = useState(Boolean(publicacion.me_gusta));
  const [likes, setLikes] = useState(publicacion.likes_count ?? 0);
  const [comentarios, setComentarios] = useState(null);
  const [cuantosComentarios, setCuantos] = useState(publicacion.comments_count ?? 0);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [pendiente, empezar] = useTransition();
  const { aviso, pedirCuenta, limpiar } = usarPuerta(volverA);
  const campo = useRef(null);

  const esVid = esVideo(publicacion.media_mime);

  function corazon(valor) {
    setMeGusta(valor);
    setLikes((n) => Math.max(0, n + (valor ? 1 : -1)));

    empezar(async () => {
      const r = await alternarMeGusta(publicacion.id, valor);
      if (!r.ok) {
        setMeGusta(!valor);
        setLikes((n) => Math.max(0, n + (valor ? -1 : 1)));
        if (r.motivo === "sesion") {
          pedirCuenta({
            que: "megusta",
            id: publicacion.id,
            texto: "Entra a tu cuenta para dar Me gusta.",
          });
        }
      }
    });
  }

  async function abrirComentarios() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (!siguiente || comentarios !== null) return;

    setCargando(true);
    const r = await comentariosDe(publicacion.id);
    setCargando(false);
    setComentarios(r.comentarios);
  }

  async function enviar(e) {
    e?.preventDefault?.();
    const cuerpo = texto.trim();
    if (!cuerpo) return;

    setError("");
    const r = await comentar(publicacion.id, cuerpo);

    if (!r.ok) {
      if (r.motivo === "sesion") {
        pedirCuenta({
          que: "comentar",
          id: publicacion.id,
          texto: "Entra a tu cuenta para comentar.",
          borrador: cuerpo,
        });
        return;
      }
      setError(
        r.motivo === "largo"
          ? `El comentario es demasiado largo. Máximo ${MAX_TEXTO_COMENTARIO} caracteres.`
          : "No pudimos publicar tu comentario. Inténtalo otra vez.",
      );
      return;
    }

    setTexto("");
    setAbierto(true);
    setComentarios((previos) => [...(previos ?? []), r.comentario]);
    setCuantos((n) => n + 1);
  }

  async function quitar(id) {
    const antes = comentarios;
    setComentarios((previos) => (previos ?? []).filter((c) => c.id !== id));
    setCuantos((n) => Math.max(0, n - 1));

    const r = await borrarComentario(id);
    if (!r.ok) {
      setComentarios(antes);
      setCuantos((n) => n + 1);
    }
  }

  // Lo que quedó a medias antes de entrar: el corazón se da y el comentario se
  // reescribe en el campo, listo para mandar. No se manda solo a propósito —un
  // texto publicado sin que la persona lo vuelva a ver sería una sorpresa—,
  // pero tampoco se pierde, que era el problema.
  useAccionPendiente(
    (nota) => nota.id === publicacion.id,
    (nota) => {
      if (nota.que === "megusta") corazon(true);
      if (nota.que === "comentar" && nota.borrador) {
        setTexto(nota.borrador);
        setAbierto(true);
        campo.current?.focus();
      }
    },
  );

  return (
    <article className="publicacion">
      <header className="publicacion-cabeza">
        <span className="publicacion-avatar" aria-hidden="true">
          {publicacion.restaurant_foto ? (
            <img src={publicacion.restaurant_foto} alt="" />
          ) : (
            <span>{(nombre ?? "?").slice(0, 1)}</span>
          )}
        </span>
        <span className="publicacion-quien">
          {slug ? (
            <Link href={`/${slug}`} className="publicacion-nombre">
              {nombre}
            </Link>
          ) : (
            <strong className="publicacion-nombre">{nombre}</strong>
          )}
          <span className="publicacion-fecha">{hace(publicacion.created_at)}</span>
        </span>

        {alBorrar ? (
          <button
            type="button"
            className="publicacion-quitar"
            onClick={() => alBorrar(publicacion)}
            aria-label="Dejar de seguir este restaurante"
          >
            Dejar de seguir
          </button>
        ) : null}
      </header>

      <figure className="publicacion-media">
        {esVid ? (
          // `controls` porque un video en un feed no puede empezar solo con
          // sonido, y `preload="metadata"` para que diez publicaciones no bajen
          // cien megas antes de que nadie toque nada.
          <video src={publicacion.url} controls playsInline preload="metadata" />
        ) : (
          <img
            src={publicacion.url}
            alt={publicacion.body || `Publicación de ${nombre}`}
            loading="lazy"
          />
        )}
      </figure>

      {publicacion.body ? <p className="publicacion-texto">{publicacion.body}</p> : null}

      <div className="publicacion-acciones">
        <button
          type="button"
          className={meGusta ? "publicacion-accion es-activa" : "publicacion-accion"}
          onClick={() => corazon(!meGusta)}
          disabled={pendiente}
          aria-pressed={meGusta}
        >
          <IconoCorazon ancho={19} relleno={meGusta} />
          {conteo(likes)} {plural(likes, "Me gusta", "Me gusta")}
        </button>

        <button
          type="button"
          className="publicacion-accion"
          onClick={abrirComentarios}
          aria-expanded={abierto}
        >
          <IconoComentario ancho={19} />
          {conteo(cuantosComentarios)}{" "}
          {plural(cuantosComentarios, "comentario", "comentarios")}
        </button>
      </div>

      {abierto ? (
        <div className="publicacion-hilo">
          {cargando ? (
            <p className="publicacion-cargando">Cargando comentarios…</p>
          ) : comentarios?.length ? (
            <ul className="comentarios">
              {comentarios.map((c) => (
                <li key={c.id}>
                  <span className="comentario-avatar" aria-hidden="true">
                    {c.author_name.slice(0, 1)}
                  </span>
                  <span className="comentario-cuerpo">
                    <span className="comentario-quien">
                      <strong>{c.author_name}</strong>
                      <span>{hace(c.created_at)}</span>
                    </span>
                    <span className="comentario-texto">{c.body}</span>
                  </span>
                  {c.puedo_borrar ? (
                    <button
                      type="button"
                      className="comentario-borrar"
                      onClick={() => quitar(c.id)}
                      aria-label="Borrar comentario"
                    >
                      <IconoBote ancho={16} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="publicacion-cargando">
              Todavía no hay comentarios. El tuyo sería el primero.
            </p>
          )}
        </div>
      ) : null}

      <form className="comentario-form" onSubmit={enviar}>
        <span className="comentario-avatar comentario-avatar-mio" aria-hidden="true" />
        <input
          ref={campo}
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe un comentario…"
          maxLength={MAX_TEXTO_COMENTARIO}
          aria-label={`Escribe un comentario para la publicación de ${nombre}`}
        />
        {texto.trim() ? (
          <button type="submit" className="btn btn-sm">
            Publicar
          </button>
        ) : null}
      </form>

      {error ? <p className="form-msg err">{error}</p> : null}
      <AvisoPuerta aviso={aviso} volverA={volverA} alCerrar={limpiar} />
    </article>
  );
}
