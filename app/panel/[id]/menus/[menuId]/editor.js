"use client";

import { useActionState, useRef, useState } from "react";
import { aTextoDePrecio, pesos } from "../../../../../lib/precios";
import {
  iconoDePlatillo,
  sugerirIcono,
  ICONOS_PLATILLO,
  SIN_ICONO,
} from "../../../../../lib/iconos-platillo";
import {
  GRUPOS_ETIQUETA,
  TIPO_ALERGENO,
  fraseDeAlergenos,
  partirEtiquetas,
} from "../../../../../lib/etiquetas-platillo";
import { IconoPlatillo } from "../../../../menu-iconos";
import { IconoEtiqueta } from "../../../../etiquetas-iconos";
import {
  borrarPlatillo,
  borrarSeccion,
  cambiarDisponibilidad,
  crearSeccion,
  guardarPlatillo,
  moverPlatillo,
  moverSeccion,
  renombrarSeccion,
} from "../actions";

const inicial = { status: "idle", message: "" };

// El editor arma los mismos grupos que la ficha pública: una sección por
// bloque y, al final, los platillos que se quedaron sin sección. Ese último
// grupo solo aparece si tiene algo; si no, sería una caja vacía permanente.
export default function Editor({
  id,
  menuId,
  secciones,
  platillos,
  catalogoEtiquetas = [],
}) {
  const sueltos = platillos.filter((p) => !p.section_id);

  return (
    <section className="bloque-menu">
      <h2 className="sub">Secciones y platillos</h2>
      <p className="ayuda">
        Primero la sección —entradas, platos fuertes, bebidas, la que quieras—
        y dentro sus platillos con su precio.
      </p>

      {secciones.map((s, i) => (
        <Seccion
          key={s.id}
          id={id}
          menuId={menuId}
          seccion={s}
          platillos={platillos.filter((p) => p.section_id === s.id)}
          catalogoEtiquetas={catalogoEtiquetas}
          primera={i === 0}
          ultima={i === secciones.length - 1}
        />
      ))}

      {sueltos.length ? (
        <Seccion
          id={id}
          menuId={menuId}
          seccion={null}
          platillos={sueltos}
          catalogoEtiquetas={catalogoEtiquetas}
          primera
          ultima
        />
      ) : null}

      <NuevaSeccion id={id} menuId={menuId} hayAlguna={secciones.length > 0} />
    </section>
  );
}

function NuevaSeccion({ id, menuId, hayAlguna }) {
  const formulario = useRef(null);
  const [state, action, pending] = useActionState(async (prev, formData) => {
    const resultado = await crearSeccion(prev, formData);
    if (resultado.status === "ok") formulario.current?.reset();
    return resultado;
  }, inicial);

  return (
    <form action={action} className="form-linea" ref={formulario}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="menu" value={menuId} />
      <label className="campo campo-crece">
        <span>{hayAlguna ? "Otra sección" : "Tu primera sección"}</span>
        <input
          type="text"
          name="nombre"
          required
          maxLength={60}
          placeholder="Entradas, Bebidas, Postres…"
        />
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Agregando…" : "Agregar sección"}
      </button>

      {state.status !== "idle" ? (
        <p
          className={state.status === "ok" ? "form-msg ok" : "form-msg err"}
          role={state.status === "ok" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function Seccion({
  id,
  menuId,
  seccion,
  platillos,
  catalogoEtiquetas,
  primera,
  ultima,
}) {
  const [renombrando, setRenombrando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const suelta = seccion === null;

  return (
    <article className="editor-seccion">
      <header className="editor-seccion-cabeza">
        {renombrando && seccion ? (
          <RenombrarSeccion
            id={id}
            menuId={menuId}
            seccion={seccion}
            alTerminar={() => setRenombrando(false)}
          />
        ) : (
          <>
            <h3>{suelta ? "Sin sección" : seccion.name}</h3>
            <div className="editor-seccion-acciones">
              {suelta ? (
                <span className="ayuda">
                  Estos platillos no están en ninguna sección. Edítalos para
                  ponerles una.
                </span>
              ) : (
                <>
                  <div className="fila-orden">
                    <FormaOrden
                      id={id}
                      menuId={menuId}
                      campo="seccion"
                      valor={seccion.id}
                      dir="arriba"
                      accion={moverSeccion}
                      desactivado={primera}
                      etiqueta={`Subir ${seccion.name}`}
                    />
                    <FormaOrden
                      id={id}
                      menuId={menuId}
                      campo="seccion"
                      valor={seccion.id}
                      dir="abajo"
                      accion={moverSeccion}
                      desactivado={ultima}
                      etiqueta={`Bajar ${seccion.name}`}
                    />
                  </div>
                  <button
                    className="btn-texto"
                    type="button"
                    onClick={() => setRenombrando(true)}
                  >
                    Renombrar
                  </button>
                  <form
                    action={borrarSeccion}
                    onSubmit={(e) => {
                      const ok = window.confirm(
                        `Se borra la sección "${seccion.name}". Sus platillos se quedan en el menú, sin agrupar.`,
                      );
                      if (!ok) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="menu" value={menuId} />
                    <input type="hidden" name="seccion" value={seccion.id} />
                    <button className="btn-texto btn-peligro" type="submit">
                      Borrar
                    </button>
                  </form>
                </>
              )}
            </div>
          </>
        )}
      </header>

      {platillos.length ? (
        <ul className="editor-platillos">
          {platillos.map((p, i) =>
            editando === p.id ? (
              <li key={p.id} className="editor-platillo editor-platillo-abierto">
                <PlatilloForm
                  id={id}
                  menuId={menuId}
                  seccionId={seccion?.id ?? ""}
                  platillo={p}
                  catalogoEtiquetas={catalogoEtiquetas}
                  alTerminar={() => setEditando(null)}
                />
              </li>
            ) : (
              <li key={p.id} className="editor-platillo">
                <DibujoDeFila platillo={p} />
                <div className="editor-platillo-datos">
                  <span className={p.is_available ? "menu-nombre" : "menu-nombre agotado"}>
                    {p.name}
                  </span>
                  {p.description ? (
                    <span className="menu-desc">{p.description}</span>
                  ) : null}
                  <EtiquetasDeFila platillo={p} />
                  {!p.is_available ? (
                    <span className="menu-etiqueta">Agotado hoy</span>
                  ) : null}
                </div>

                <span className="menu-precio">{pesos(p.price_cents) ?? "Sin precio"}</span>

                <div className="fila-orden">
                  <FormaOrden
                    id={id}
                    menuId={menuId}
                    campo="platillo"
                    valor={p.id}
                    seccionId={seccion?.id ?? ""}
                    dir="arriba"
                    accion={moverPlatillo}
                    desactivado={i === 0}
                    etiqueta={`Subir ${p.name}`}
                  />
                  <FormaOrden
                    id={id}
                    menuId={menuId}
                    campo="platillo"
                    valor={p.id}
                    seccionId={seccion?.id ?? ""}
                    dir="abajo"
                    accion={moverPlatillo}
                    desactivado={i === platillos.length - 1}
                    etiqueta={`Bajar ${p.name}`}
                  />
                </div>

                <div className="editor-platillo-acciones">
                  <button
                    className="btn-texto"
                    type="button"
                    onClick={() => setEditando(p.id)}
                  >
                    Editar
                  </button>
                  <form action={cambiarDisponibilidad}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="menu" value={menuId} />
                    <input type="hidden" name="platillo" value={p.id} />
                    <button className="btn-texto" type="submit">
                      {p.is_available ? "Marcar agotado" : "Hay de nuevo"}
                    </button>
                  </form>
                  <form
                    action={borrarPlatillo}
                    onSubmit={(e) => {
                      const ok = window.confirm(`Se borra "${p.name}" del menú.`);
                      if (!ok) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="menu" value={menuId} />
                    <input type="hidden" name="platillo" value={p.id} />
                    <button className="btn-texto btn-peligro" type="submit">
                      Borrar
                    </button>
                  </form>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="nota-borrador">Esta sección todavía no tiene platillos.</p>
      )}

      {suelta ? null : agregando ? (
        <PlatilloForm
          id={id}
          menuId={menuId}
          seccionId={seccion.id}
          platillo={null}
          catalogoEtiquetas={catalogoEtiquetas}
          alTerminar={() => setAgregando(false)}
        />
      ) : (
        <button className="btn-texto" type="button" onClick={() => setAgregando(true)}>
          + Agregar platillo a {seccion.name}
        </button>
      )}
    </article>
  );
}

// Los botones de orden son formularios sueltos y no un componente con estado:
// mover es una acción del servidor y la página se vuelve a pintar con el orden
// nuevo, sin nada que sincronizar en el navegador.
function FormaOrden({
  id,
  menuId,
  campo,
  valor,
  seccionId,
  dir,
  accion,
  desactivado,
  etiqueta,
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="menu" value={menuId} />
      <input type="hidden" name={campo} value={valor} />
      {seccionId !== undefined && campo === "platillo" ? (
        <input type="hidden" name="seccion" value={seccionId} />
      ) : null}
      <input type="hidden" name="dir" value={dir} />
      <button
        className="btn-orden"
        type="submit"
        disabled={desactivado}
        aria-label={etiqueta}
      >
        {dir === "arriba" ? "↑" : "↓"}
      </button>
    </form>
  );
}

function RenombrarSeccion({ id, menuId, seccion, alTerminar }) {
  const [state, action, pending] = useActionState(async (prev, formData) => {
    const resultado = await renombrarSeccion(prev, formData);
    if (resultado.status === "ok") alTerminar();
    return resultado;
  }, inicial);

  return (
    <form action={action} className="form-linea">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="menu" value={menuId} />
      <input type="hidden" name="seccion" value={seccion.id} />
      <label className="campo campo-crece">
        <span>Nombre de la sección</span>
        <input
          type="text"
          name="nombre"
          defaultValue={seccion.name}
          required
          maxLength={60}
          autoFocus
        />
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
      <button className="btn-texto" type="button" onClick={alTerminar}>
        Cancelar
      </button>

      {state.status === "error" ? (
        <p className="form-msg err" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

// Mismo formulario para agregar y para editar: los campos son idénticos y la
// acción distingue por el id oculto. Duplicarlo solo garantizaría que uno de
// los dos se quede sin el siguiente campo que agreguemos.
function PlatilloForm({
  id,
  menuId,
  seccionId,
  platillo,
  catalogoEtiquetas,
  alTerminar,
}) {
  const formulario = useRef(null);
  // El nombre se lleva en estado porque de él sale el dibujo sugerido: se
  // escribe "Hamburguesa" y el dibujo aparece antes de guardar.
  const [nombre, setNombre] = useState(platillo?.name ?? "");
  const [icono, setIcono] = useState(platillo?.icon ?? "auto");
  // Las etiquetas se llevan en un Set y no en el DOM porque una casilla sin
  // palomita no viaja en el formulario: sin estado, quitar la última etiqueta
  // de un platillo no se distinguiría de no haber tocado nada.
  const [etiquetas, setEtiquetas] = useState(
    () => new Set(Array.isArray(platillo?.labels) ? platillo.labels : []),
  );
  const [state, action, pending] = useActionState(async (prev, formData) => {
    const resultado = await guardarPlatillo(prev, formData);
    if (resultado.status === "ok") {
      if (platillo) {
        alTerminar();
      } else {
        formulario.current?.reset();
        setNombre("");
        setIcono("auto");
        setEtiquetas(new Set());
      }
    }
    return resultado;
  }, inicial);

  function alternarEtiqueta(slug) {
    setEtiquetas((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(slug)) ahora.delete(slug);
      else ahora.add(slug);
      return ahora;
    });
  }

  const sugerido = sugerirIcono(nombre);
  const dibujo = icono === SIN_ICONO ? null : icono === "auto" ? sugerido : icono;

  return (
    <form action={action} className="form-platillo" ref={formulario}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="menu" value={menuId} />
      <input type="hidden" name="seccion" value={seccionId} />
      {platillo ? <input type="hidden" name="platillo" value={platillo.id} /> : null}

      <div className="form-platillo-fila">
        <label className="campo campo-crece">
          <span>Platillo</span>
          <input
            type="text"
            name="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            maxLength={120}
            placeholder="Taco de suadero"
            autoFocus
          />
        </label>
        <label className="campo campo-precio">
          <span>
            Precio <em>opcional</em>
          </span>
          <input
            type="text"
            name="precio"
            inputMode="decimal"
            defaultValue={aTextoDePrecio(platillo?.price_cents)}
            placeholder="89.50"
          />
        </label>
      </div>

      <label className="campo">
        <span>
          Descripción <em>opcional</em>
        </span>
        <input
          type="text"
          name="descripcion"
          defaultValue={platillo?.description ?? ""}
          maxLength={200}
          placeholder="Con cebolla, cilantro y salsa de la casa"
        />
      </label>

      {/* El dibujo del platillo. Se sugiere del nombre para que no sea un
          campo más que llenar: quien no lo toque igual sale con dibujo. */}
      <div className="campo campo-dibujo">
        <span className="campo-etiqueta">
          Dibujo <em>solo se ve en las plantillas que los traen puestos</em>
        </span>
        <div className="campo-dibujo-fila">
          <span className="campo-dibujo-muestra">
            {dibujo ? <IconoPlatillo slug={dibujo} ancho={30} /> : <em>sin dibujo</em>}
          </span>
          <select
            name="icono"
            value={icono}
            onChange={(e) => setIcono(e.target.value)}
          >
            <option value="auto">
              Automático{nombre.trim() ? ` — ${nombreDeIcono(sugerido)}` : ""}
            </option>
            <option value={SIN_ICONO}>Sin dibujo</option>
            {ICONOS_PLATILLO.map(([slug, nombreIcono]) => (
              <option key={slug} value={slug}>
                {nombreIcono}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Las etiquetas: lo que el platillo declara de sí mismo. Van plegadas
          porque son treinta casillas y la mayoría de los platillos no llevan
          ninguna; el renglón del resumen dice cuáles tiene sin abrirlas. */}
      <EtiquetasDelPlatillo
        catalogo={catalogoEtiquetas}
        marcadas={etiquetas}
        alAlternar={alternarEtiqueta}
      />

      <label className="eleccion eleccion-sola">
        <input
          type="checkbox"
          name="agotado"
          defaultChecked={platillo ? !platillo.is_available : false}
        />
        <span>
          <strong>Agotado hoy</strong>
          <em>Sigue en la carta, pero tachado.</em>
        </span>
      </label>

      <div className="form-platillo-acciones">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Guardando…" : platillo ? "Guardar platillo" : "Agregar platillo"}
        </button>
        <button className="btn-texto" type="button" onClick={alTerminar}>
          {platillo ? "Cancelar" : "Listo"}
        </button>
      </div>

      {state.status !== "idle" ? (
        <p
          className={state.status === "ok" ? "form-msg ok" : "form-msg err"}
          role={state.status === "ok" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function nombreDeIcono(slug) {
  return ICONOS_PLATILLO.find(([s]) => s === slug)?.[1] ?? "";
}

// En la lista el dueño ve el mismo dibujo que va a salir en la carta, sin
// tener que abrir el platillo para acordarse de cuál le tocó.
function DibujoDeFila({ platillo }) {
  const slug = iconoDePlatillo(platillo);
  if (!slug) return null;
  return (
    <span className="editor-platillo-dibujo" aria-hidden="true">
      <IconoPlatillo slug={slug} ancho={24} />
    </span>
  );
}

/**
 * El selector de etiquetas, plegado y en sus tres grupos.
 *
 * Va dentro de un `<details>` y no abierto porque son treinta casillas debajo
 * de un formulario de cuatro campos: quien captura veinte platillos no quiere
 * pasar por ellas cada vez. El resumen dice lo que hay marcado, así que el
 * pliegue no esconde nada que haga falta ver.
 *
 * Las casillas marcadas viajan como campos ocultos y no como `checkbox` del
 * formulario: un `checkbox` sin palomita no llega, y "este platillo ya no lleva
 * ninguna" tiene que poder distinguirse de "no toqué las etiquetas".
 */
function EtiquetasDelPlatillo({ catalogo, marcadas, alAlternar }) {
  if (!catalogo.length) return null;

  const elegidas = catalogo.filter((e) => marcadas.has(e.slug));
  const { distintivos, alergenos } = partirEtiquetas(elegidas);

  return (
    <details className="campo-etiquetas" open={elegidas.length > 0}>
      <summary>
        <span className="campo-etiqueta">Etiquetas</span>
        <span className="campo-etiquetas-resumen">
          {elegidas.length
            ? [
                distintivos.map((e) => e.nombre).join(", "),
                alergenos.length ? `contiene ${fraseDeAlergenos(alergenos)}` : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : "Vegetariano, sin gluten, picante, alérgenos…"}
        </span>
      </summary>

      {marcadas.size
        ? [...marcadas].map((slug) => (
            <input type="hidden" name="etiquetas" value={slug} key={slug} />
          ))
        : null}

      {GRUPOS_ETIQUETA.map(([tipo, titulo, pista]) => {
        const delGrupo = catalogo.filter((e) => e.tipo === tipo);
        if (!delGrupo.length) return null;

        return (
          <fieldset className="etiquetas-grupo" key={tipo}>
            <legend>{titulo}</legend>
            <p className="ayuda">{pista}</p>
            <div className="etiquetas-edicion">
              {delGrupo.map((etiqueta) => (
                <label
                  className={
                    tipo === TIPO_ALERGENO
                      ? "etiqueta-opcion etiqueta-opcion-alergeno"
                      : "etiqueta-opcion"
                  }
                  key={etiqueta.slug}
                >
                  <input
                    type="checkbox"
                    checked={marcadas.has(etiqueta.slug)}
                    onChange={() => alAlternar(etiqueta.slug)}
                  />
                  <span className="etiqueta-cara" title={etiqueta.pista}>
                    <IconoEtiqueta slug={etiqueta.icono} ancho={17} />
                    <span>{etiqueta.nombre}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </details>
  );
}

// En la lista, las etiquetas se leen igual que en la carta: los distintivos
// como marcas y los alérgenos como el renglón "Contiene". Así el dueño revisa
// lo que puso sin abrir platillo por platillo.
function EtiquetasDeFila({ platillo }) {
  const { distintivos, alergenos } = partirEtiquetas(platillo.etiquetas);
  if (!distintivos.length && !alergenos.length) return null;

  return (
    <>
      {distintivos.length ? (
        <span className="menu-etiquetas">
          {distintivos.map((e) => (
            <span className="menu-marca" key={e.slug} title={e.pista}>
              <IconoEtiqueta slug={e.icono} ancho={14} />
              <span>{e.nombre}</span>
            </span>
          ))}
        </span>
      ) : null}
      {alergenos.length ? (
        <span className="menu-alergenos">Contiene: {fraseDeAlergenos(alergenos)}</span>
      ) : null}
    </>
  );
}
