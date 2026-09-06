"use client";

import { useActionState, useState } from "react";
import { borrar, editarTexto } from "./actions";
import { conteo, esVideo, hace, leQueda, MAX_TEXTO_POST, plural } from "../../../lib/social";
import {
  IconoBote,
  IconoComentario,
  IconoCorazon,
  IconoDestello,
  IconoLapiz,
  IconoOjo,
} from "../../_social/iconos";

const inicial = { status: "idle", message: "" };

// Lo que el dueño ya publicó, con sus números y sus dos acciones: cambiar el
// texto y borrar.
//
// El archivo no se puede cambiar a propósito. Editar la foto de una
// publicación que ya tiene likes y comentarios convertiría esos likes en likes
// de otra cosa; quien se equivocó de foto la borra y sube la buena, que es un
// clic más y ninguna mentira.
export default function Lista({ publicaciones }) {
  if (!publicaciones.length) {
    return (
      <div className="vacio">
        <h2>Todavía no publicas nada</h2>
        <p>
          Una historia dura 24 horas y sirve para lo de hoy: el plato que acaba
          de salir, que hoy cierran temprano. Una publicación se queda en tu
          ficha hasta que la borres.
        </p>
      </div>
    );
  }

  return (
    <ul className="post-lista">
      {publicaciones.map((p) => (
        <Fila key={p.id} publicacion={p} />
      ))}
    </ul>
  );
}

function Fila({ publicacion }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(publicacion.body ?? "");
  const [borrado, setBorrado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const [estadoEditar, accionEditar, editandoPend] = useActionState(editarTexto, inicial);
  const [estadoBorrar, accionBorrar, borrandoPend] = useActionState(async (prev, formData) => {
    const r = await borrar(prev, formData);
    if (r.status === "ok") setBorrado(true);
    return r;
  }, inicial);

  // Ya borrada: la fila se queda un momento diciéndolo en vez de desaparecer de
  // golpe, que se lee como un fallo de la página.
  if (borrado) {
    return (
      <li className="post-fila post-fila-ida">
        <p>Borrado.</p>
      </li>
    );
  }

  const caducada = publicacion.kind === "historia" && new Date(publicacion.expires_at) <= new Date();
  const restaurantes = Array.isArray(publicacion.restaurantes) ? publicacion.restaurantes : [];

  return (
    <li className="post-fila">
      <figure className="post-fila-media">
        {esVideo(publicacion.media_mime) ? (
          <video src={publicacion.url} preload="metadata" muted playsInline />
        ) : (
          <img src={publicacion.url} alt="" loading="lazy" />
        )}
      </figure>

      <div className="post-fila-cuerpo">
        <div className="post-fila-cabeza">
          <span
            className={
              publicacion.kind === "historia" ? "post-etiqueta es-historia" : "post-etiqueta"
            }
          >
            {publicacion.kind === "historia" ? <IconoDestello ancho={14} /> : null}
            {publicacion.kind === "historia" ? "Historia" : "Publicación"}
          </span>
          <span className="post-fila-fecha">
            {hace(publicacion.created_at)}
            {publicacion.kind === "historia" ? (
              <> · {caducada ? "Ya caducó" : leQueda(publicacion.expires_at)}</>
            ) : null}
          </span>
        </div>

        {editando ? (
          <form action={accionEditar} className="post-editar">
            <input type="hidden" name="id" value={publicacion.id} />
            <textarea
              name="body"
              rows={2}
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
          <p className="post-fila-texto">
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
          <p className="post-fila-donde">
            En {restaurantes.map((r) => r.name).join(" · ")}
          </p>
        ) : null}

        {/* Los números. Las historias cuentan visualizaciones y las
            publicaciones no: una publicación se ve al bajar por la ficha, así
            que "vistas" ahí querría decir algo distinto y no se mide. */}
        <ul className="post-numeros">
          {publicacion.kind === "historia" ? (
            <li>
              <IconoOjo ancho={17} />
              <strong>{conteo(publicacion.views_count)}</strong>{" "}
              {plural(publicacion.views_count, "visualización", "visualizaciones")}
            </li>
          ) : null}
          <li>
            <IconoCorazon ancho={17} />
            <strong>{conteo(publicacion.likes_count)}</strong> Me gusta
          </li>
          <li>
            <IconoComentario ancho={17} />
            <strong>{conteo(publicacion.comments_count)}</strong>{" "}
            {plural(publicacion.comments_count, "comentario", "comentarios")}
          </li>
        </ul>

        <div className="post-fila-acciones">
          {!editando ? (
            <button className="btn-texto" type="button" onClick={() => setEditando(true)}>
              <IconoLapiz ancho={16} />
              Editar texto
            </button>
          ) : null}

          {/* Borrar pide confirmación en el sitio y no en un diálogo del
              navegador: es irreversible y se lleva por delante los comentarios
              de otras personas. */}
          {confirmando ? (
            <form action={accionBorrar} className="post-borrar">
              <input type="hidden" name="id" value={publicacion.id} />
              <span>¿Seguro? Se borra con sus Me gusta y sus comentarios.</span>
              <button className="btn-texto es-peligro" type="submit" disabled={borrandoPend}>
                {borrandoPend ? "Borrando…" : "Sí, borrar"}
              </button>
              <button className="btn-texto" type="button" onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
            </form>
          ) : (
            <button
              className="btn-texto es-peligro"
              type="button"
              onClick={() => setConfirmando(true)}
            >
              <IconoBote ancho={16} />
              Borrar
            </button>
          )}
        </div>

        {estadoBorrar.status === "error" ? (
          <p className="form-msg err" role="status">
            {estadoBorrar.message}
          </p>
        ) : null}
      </div>
    </li>
  );
}
