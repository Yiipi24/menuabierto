"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { borrar, editarTexto, reprogramar } from "./actions";
import {
  conteo,
  cuandoSale,
  esVideo,
  estaProgramada,
  hace,
  leQueda,
  paraInputLocal,
  revisarProgramacion,
  MAX_TEXTO_POST,
} from "../../../lib/social";
import {
  IconoAvion,
  IconoBote,
  IconoComentario,
  IconoCorazon,
  IconoDestello,
  IconoLapiz,
  IconoMas,
  IconoChevronDer,
  IconoOjo,
  IconoReloj,
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

  // Lo programado se pinta arriba y en su propia lista. Mezclado con lo ya
  // publicado se pierde: es lo único que todavía se puede mover de fecha o
  // adelantar, y buscarlo entre treinta tarjetas no es buscar, es acordarse.
  const programadas = publicaciones.filter((p) => estaProgramada(p));
  const salidas = publicaciones.filter((p) => !estaProgramada(p));

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

  const visibles = todas ? salidas : salidas.slice(0, DE_ENTRADA);

  return (
    <>
      {programadas.length ? (
        <section className="post-programadas">
          <div className="post-lista-cabeza">
            <h2 className="sub">
              <IconoReloj ancho={17} />
              Programado
            </h2>
            <span className="post-lista-cuenta">
              {programadas.length === 1
                ? "1 pieza esperando su hora"
                : `${programadas.length} piezas esperando su hora`}
            </span>
          </div>

          <ul className="post-lista">
            {programadas.map((p) => (
              <Tarjeta key={p.id} publicacion={p} programada />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="post-lista-cabeza">
        <h2 className="sub">Lo que ya publicaste</h2>
        {salidas.length > DE_ENTRADA ? (
          <button className="btn-texto" type="button" onClick={() => setTodas((v) => !v)}>
            {todas ? "Ver menos" : "Ver todas mis publicaciones"}
            <IconoChevronDer ancho={16} />
          </button>
        ) : null}
      </div>

      {salidas.length ? (
        <ul className="post-lista">
          {visibles.map((p) => (
            <Tarjeta key={p.id} publicacion={p} />
          ))}
        </ul>
      ) : (
        <p className="ayuda">
          Todavía no ha salido nada. Lo de arriba aparecerá aquí solo, cuando llegue su hora.
        </p>
      )}
    </>
  );
}

function Tarjeta({ publicacion, programada = false }) {
  const caja = useRef(null);
  const [menu, setMenu] = useState(false);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(publicacion.body ?? "");
  const [borrado, setBorrado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cambiandoFecha, setCambiandoFecha] = useState(false);
  const [fecha, setFecha] = useState("");
  const [minimo, setMinimo] = useState("");
  // La hora se pinta hasta que el componente monta: escrita en el servidor
  // sería la hora de UTC, y quien programó "las 8 de la noche" leería otra.
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    setFecha(paraInputLocal(publicacion.publish_at));
    setMinimo(paraInputLocal(new Date()));
  }, [publicacion.publish_at]);

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

  // Cambiar la fecha y publicar ahora son la misma acción —cuándo sale— y por
  // eso el mismo formulario: el botón que se pulsa dice cuál de las dos.
  const [estadoFecha, accionFecha, fechaPend] = useActionState(async (prev, formData) => {
    const r = await reprogramar(prev, formData);
    if (r.status === "ok") setCambiandoFecha(false);
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
  const avisoFecha = fecha ? revisarProgramacion(fecha) : null;
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
          {programada ? (
            <span className="post-tarjeta-fecha es-programada">
              <IconoReloj ancho={13} />
              {montado ? `Sale ${cuandoSale(publicacion.publish_at).toLowerCase()}` : "Programado"}
            </span>
          ) : (
            <span className="post-tarjeta-fecha">
              {hace(publicacion.publish_at ?? publicacion.created_at)}
              {esHistoria ? (
                <> · {caducada ? "Ya caducó" : leQueda(publicacion.expires_at)}</>
              ) : null}
            </span>
          )}
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
          {/* Una pieza programada no tiene números que enseñar: cero Me gusta
              en algo que nadie ha visto no es un dato, es ruido. En su sitio va
              lo único que ahí importa, que es qué hacer con la fecha. */}
          {programada ? (
            <li className="post-numeros-programada">
              <button
                type="button"
                className="btn-texto"
                onClick={() => setCambiandoFecha((v) => !v)}
              >
                <IconoReloj ancho={16} />
                {cambiandoFecha ? "Cerrar" : "Cambiar fecha"}
              </button>
            </li>
          ) : null}

          {!programada && esHistoria ? (
            <li title="Visualizaciones">
              <IconoOjo ancho={16} />
              {conteo(publicacion.views_count)}
            </li>
          ) : null}
          {!programada ? (
            <li title="Me gusta">
              <IconoCorazon ancho={16} />
              {conteo(publicacion.likes_count)}
            </li>
          ) : null}
          {!programada ? (
            <li title="Comentarios">
              <IconoComentario ancho={16} />
              {conteo(publicacion.comments_count)}
            </li>
          ) : null}

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
                {programada ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setCambiandoFecha(true);
                      setMenu(false);
                    }}
                  >
                    <IconoReloj ancho={16} />
                    Cambiar fecha
                  </button>
                ) : null}
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

        {/* Cambiar la fecha, o mandarlo ya. Lo segundo va como botón del mismo
            formulario porque es la misma decisión: adelantar la salida hasta
            ahora mismo. */}
        {programada && cambiandoFecha ? (
          <form action={accionFecha} className="post-reprogramar">
            <input type="hidden" name="id" value={publicacion.id} />
            <label htmlFor={`fecha-${publicacion.id}`}>Nueva fecha y hora</label>
            <input
              id={`fecha-${publicacion.id}`}
              className="post-fecha"
              type="datetime-local"
              name="publish_at"
              value={fecha}
              min={minimo}
              onChange={(e) => setFecha(e.target.value)}
            />

            {avisoFecha ? (
              <p className="form-msg err" role="status">
                {avisoFecha}
              </p>
            ) : null}

            <div className="post-reprogramar-botones">
              <button
                className="btn btn-sm"
                type="submit"
                disabled={fechaPend || Boolean(avisoFecha)}
              >
                {fechaPend ? "Guardando…" : "Guardar fecha"}
              </button>
              {/* El nombre del botón viaja con su valor: la acción distingue
                  "guardar esta fecha" de "publicar ahora" por él. */}
              <button
                className="btn-linea btn-sm"
                type="submit"
                name="ahora"
                value="1"
                disabled={fechaPend}
              >
                <IconoAvion ancho={15} />
                Publicar ahora
              </button>
              <button
                className="btn-texto"
                type="button"
                onClick={() => {
                  setFecha(paraInputLocal(publicacion.publish_at));
                  setCambiandoFecha(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {estadoFecha.message ? (
          <p className={estadoFecha.status === "ok" ? "form-msg ok" : "form-msg err"} role="status">
            {estadoFecha.message}
          </p>
        ) : null}

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
