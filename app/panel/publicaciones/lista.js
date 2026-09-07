"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { borrar, editarTexto } from "./actions";
import { conteo, esVideo, hace, leQueda, MAX_TEXTO_POST } from "../../../lib/social";
import {
  IconoBote,
  IconoComentario,
  IconoCorazon,
  IconoDestello,
  IconoLapiz,
  IconoMas,
  IconoChevronDer,
  IconoOjo,
} from "../../_social/iconos";

const inicial = { status: "idle", message: "" };

// Cuántas tarjetas se enseñan de entrada. El resto está detrás de "Ver todas mis
// publicaciones": una rejilla de treinta piezas empuja el formulario fuera de la
// pantalla y lo que se viene a hacer aquí es publicar.
const DE_ENTRADA = 8;

// Lo que el dueño ya publicó, en tarjetas compactas: la miniatura, qué es,
// cuándo fue, sus números y el menú con las dos acciones.
//
// El archivo no se puede cambiar a propósito. Editar la foto de una
// publicación que ya tiene likes y comentarios convertiría esos likes en likes
// de otra cosa; quien se equivocó de foto la borra y sube la buena, que es un
// clic más y ninguna mentira.
export default function Lista({ publicaciones }) {
  const [todas, setTodas] = useState(false);

  if (!publicaciones.length) {
    return (
      <>
        <div className="post-lista-cabeza">
          <h2 className="sub">Lo que ya publicaste</h2>
        </div>
        <div className="vacio">
          <h2>Todavía no publicas nada</h2>
          <p>
            Una historia dura 24 horas y sirve para lo de hoy: el plato que acaba
            de salir, que hoy cierran temprano. Una publicación se queda en tu
            ficha hasta que la borres.
          </p>
        </div>
      </>
    );
  }

  const visibles = todas ? publicaciones : publicaciones.slice(0, DE_ENTRADA);

  return (
    <>
      <div className="post-lista-cabeza">
        <h2 className="sub">Lo que ya publicaste</h2>
        {publicaciones.length > DE_ENTRADA ? (
          <button className="btn-texto" type="button" onClick={() => setTodas((v) => !v)}>
            {todas ? "Ver menos" : "Ver todas mis publicaciones"}
            <IconoChevronDer ancho={16} />
          </button>
        ) : null}
      </div>

      <ul className="post-lista">
        {visibles.map((p) => (
          <Tarjeta key={p.id} publicacion={p} />
        ))}
      </ul>
    </>
  );
}

function Tarjeta({ publicacion }) {
  const caja = useRef(null);
  const [menu, setMenu] = useState(false);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(publicacion.body ?? "");
  const [borrado, setBorrado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const [estadoEditar, accionEditar, editandoPend] = useActionState(async (prev, formData) => {
    const r = await editarTexto(prev, formData);
    if (r.status === "ok") setEditando(false);
    return r;
  }, inicial);

  const [estadoBorrar, accionBorrar, borrandoPend] = useActionState(async (prev, formData) => {
    const r = await borrar(prev, formData);
    if (r.status === "ok") setBorrado(true);
    return r;
  }, inicial);

  // El menú se cierra al pulsar fuera o con Escape: si no, quedan tres abiertos
  // a la vez y ninguno se sabe de quién es.
  useEffect(() => {
    if (!menu) return undefined;
    function fuera(e) {
      if (caja.current && !caja.current.contains(e.target)) setMenu(false);
    }
    function tecla(e) {
      if (e.key === "Escape") setMenu(false);
    }
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);

  // Ya borrada: la tarjeta se queda un momento diciéndolo en vez de desaparecer
  // de golpe, que se lee como un fallo de la página.
  if (borrado) {
    return (
      <li className="post-tarjeta post-tarjeta-ida">
        <p>Borrado.</p>
      </li>
    );
  }

  const esHistoria = publicacion.kind === "historia";
  const caducada = esHistoria && new Date(publicacion.expires_at) <= new Date();
  const restaurantes = Array.isArray(publicacion.restaurantes) ? publicacion.restaurantes : [];

  return (
    <li className="post-tarjeta" ref={caja}>
      <figure className="post-tarjeta-media">
        {esVideo(publicacion.media_mime) ? (
          <video src={publicacion.url} preload="metadata" muted playsInline />
        ) : (
          <img src={publicacion.url} alt="" loading="lazy" />
        )}
      </figure>

      <div className="post-tarjeta-cuerpo">
        <div className="post-tarjeta-cabeza">
          <span className={esHistoria ? "post-etiqueta es-historia" : "post-etiqueta"}>
            {esHistoria ? <IconoDestello ancho={13} /> : null}
            {esHistoria ? "Historia" : "Publicación"}
          </span>
          <span className="post-tarjeta-fecha">
            {hace(publicacion.created_at)}
            {esHistoria ? <> · {caducada ? "Ya caducó" : leQueda(publicacion.expires_at)}</> : null}
          </span>
        </div>

        {editando ? (
          <form action={accionEditar} className="post-editar">
            <input type="hidden" name="id" value={publicacion.id} />
            <textarea
              name="body"
              rows={3}
              maxLength={MAX_TEXTO_POST}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Texto de la publicación"
            />
            <div className="post-editar-botones">
              <button className="btn btn-sm" type="submit" disabled={editandoPend}>
                {editandoPend ? "Guardando…" : "Guardar"}
              </button>
              <button
                className="btn-texto"
                type="button"
                onClick={() => {
                  setTexto(publicacion.body ?? "");
                  setEditando(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <p className="post-tarjeta-texto">
            {texto || <em className="post-sin-texto">Sin texto</em>}
          </p>
        )}

        {estadoEditar.message ? (
          <p
            className={estadoEditar.status === "ok" ? "form-msg ok" : "form-msg err"}
            role="status"
          >
            {estadoEditar.message}
          </p>
        ) : null}

        {restaurantes.length ? (
          <p className="post-tarjeta-donde">{restaurantes.map((r) => r.name).join(" · ")}</p>
        ) : null}

        {/* Los números. Las historias cuentan visualizaciones y las
            publicaciones no: una publicación se ve al bajar por la ficha, así
            que "vistas" ahí querría decir algo distinto y no se mide. */}
        <ul className="post-numeros">
          {esHistoria ? (
            <li title="Visualizaciones">
              <IconoOjo ancho={16} />
              {conteo(publicacion.views_count)}
            </li>
          ) : null}
          <li title="Me gusta">
            <IconoCorazon ancho={16} />
            {conteo(publicacion.likes_count)}
          </li>
          <li title="Comentarios">
            <IconoComentario ancho={16} />
            {conteo(publicacion.comments_count)}
          </li>

          <li className="post-tarjeta-menu">
            <button
              type="button"
              className="post-tarjeta-puntos"
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label="Más opciones"
              onClick={() => setMenu((v) => !v)}
            >
              <IconoMas ancho={18} />
            </button>

            {menu ? (
              <div className="post-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setEditando(true);
                    setMenu(false);
                  }}
                >
                  <IconoLapiz ancho={16} />
                  Editar texto
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="es-peligro"
                  onClick={() => {
                    setConfirmando(true);
                    setMenu(false);
                  }}
                >
                  <IconoBote ancho={16} />
                  Borrar
                </button>
              </div>
            ) : null}
          </li>
        </ul>

        {/* Borrar pide confirmación en el sitio y no en un diálogo del
            navegador: es irreversible y se lleva por delante los comentarios
            de otras personas. */}
        {confirmando ? (
          <form action={accionBorrar} className="post-borrar">
            <span>¿Seguro? Se borra con sus Me gusta y sus comentarios.</span>
            <input type="hidden" name="id" value={publicacion.id} />
            <button className="btn-texto es-peligro" type="submit" disabled={borrandoPend}>
              {borrandoPend ? "Borrando…" : "Sí, borrar"}
            </button>
            <button className="btn-texto" type="button" onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </form>
        ) : null}

        {estadoBorrar.status === "error" ? (
          <p className="form-msg err" role="status">
            {estadoBorrar.message}
          </p>
        ) : null}
      </div>
    </li>
  );
}
