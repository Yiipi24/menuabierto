"use client";

import { useActionState, useState } from "react";
import {
  admiteMarco,
  clasesDeCarta,
  estiloDeMenu,
  variablesDeEstilo,
  COLUMNAS,
  DENSIDADES,
  PALETAS,
  PLANTILLAS,
  TIPOGRAFIAS,
} from "../../../../../lib/plantillas";
import { agruparPlatillos } from "../../../../../lib/menus";
import { destacadosDe } from "../../../../destacados";
import MenuPintado from "../../../../menu-render";
import { guardarMenu } from "../actions";

const inicial = { status: "idle", message: "" };

// Con la carta vacía no hay nada que enseñar en la vista previa, y elegir
// plantilla a ciegas es justo lo que no queremos. Estos tres platillos son de
// mentiras y se van en cuanto el dueño capture el primero suyo.
const MUESTRA = [
  {
    id: "muestra",
    name: "Ejemplo de sección",
    items: [
      {
        id: "m1",
        name: "Hamburguesa de la casa",
        description: "Carne de res, queso cheddar y aderezo de la casa",
        price_cents: 12900,
        is_available: true,
      },
      {
        id: "m2",
        name: "Orden de papas",
        description: null,
        price_cents: 6500,
        is_available: true,
      },
      {
        id: "m3",
        name: "Agua de horchata",
        description: null,
        price_cents: 3500,
        is_available: true,
      },
    ],
  },
];

export default function Ajustes({ id, menu, restaurante, secciones, platillos }) {
  const [state, action, pending] = useActionState(guardarMenu, inicial);

  // El formulario entero se controla desde el estado y se vuelve a sincronizar
  // cuando cambia lo que hay en la base. Con `defaultValue` pasaba esto: al
  // guardar, React repinta el formulario con el valor con el que se montó, así
  // que la plantilla recién elegida se veía volver a la anterior y no había
  // manera de saber cuál había quedado guardada.
  const firma = `${menu.name}|${menu.kind}|${menu.template}|${menu.is_visible}|${JSON.stringify(menu.style ?? null)}`;
  const [ultimaFirma, setUltimaFirma] = useState(firma);
  const [campos, setCampos] = useState(() => camposDe(menu));

  if (firma !== ultimaFirma) {
    setUltimaFirma(firma);
    setCampos(camposDe(menu));
  }

  const { nombre, tipo, visible, template, estilo } = campos;
  const cambiar = (parche) => setCampos((c) => ({ ...c, ...parche }));
  const cambiarEstilo = (parche) =>
    setCampos((c) => ({ ...c, estilo: { ...c.estilo, ...parche } }));

  // Cambiar de plantilla trae los ajustes de fábrica de la nueva. Conservar el
  // color y la letra de la anterior haría que "Pizarrón" no se pareciera al
  // pizarrón que el dueño acaba de elegir en la lista.
  const cambiarPlantilla = (slug) =>
    setCampos((c) => ({ ...c, template: slug, estilo: estiloDeMenu(slug, null) }));

  const grupos = agruparPlatillos(secciones, platillos);
  const destacados = destacadosDe(restaurante.highlights);
  const sinCambios = firma === firmaDeCampos(campos);

  return (
    <section className="bloque-menu">
      <h2 className="sub">Ajustes del menú</h2>

      <form action={action} className="form-alta">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="menu" value={menu.id} />
        <input type="hidden" name="template" value={template} />
        <input type="hidden" name="estilo" value={JSON.stringify(estilo)} />

        <label className="campo">
          <span>Nombre</span>
          <input
            type="text"
            name="nombre"
            value={nombre}
            onChange={(e) => cambiar({ nombre: e.target.value })}
            required
            maxLength={60}
          />
        </label>

        <label className="campo">
          <span>Cómo está puesto</span>
          <select
            name="kind"
            value={tipo}
            onChange={(e) => cambiar({ tipo: e.target.value })}
          >
            <option value="digital">Capturado aquí, platillo por platillo</option>
            <option value="archivo">Un archivo que subo yo</option>
          </select>
        </label>

        <label className="eleccion eleccion-sola">
          <input
            type="checkbox"
            name="visible"
            checked={visible}
            onChange={(e) => cambiar({ visible: e.target.checked })}
          />
          <span>
            <strong>Se ve en la ficha</strong>
            <em>Quítale la palomita para prepararlo sin que nadie lo vea.</em>
          </span>
        </label>

        {tipo === "digital" ? (
          <>
            <div className="ajuste-bloque">
              <h3 className="ajuste-titulo">Plantilla</h3>
              <p className="ayuda">
                Cambia cómo se ve tu carta, no lo que dice. Todas llevan arriba
                el nombre del menú, el de tu restaurante y lo que te distingue.
              </p>

              <div className="plantilla-lista">
                {PLANTILLAS.map((p) => (
                  <label
                    key={p.slug}
                    className={
                      p.slug === template
                        ? "plantilla-opcion plantilla-elegida"
                        : "plantilla-opcion"
                    }
                  >
                    <input
                      type="radio"
                      name="plantilla-visible"
                      value={p.slug}
                      checked={p.slug === template}
                      onChange={() => cambiarPlantilla(p.slug)}
                    />
                    <Muestra plantilla={p} />
                    <span className="plantilla-nombre">
                      {p.nombre}
                      {p.slug === menu.template ? (
                        <em className="plantilla-marca">guardada</em>
                      ) : null}
                    </span>
                    <span className="plantilla-desc">{p.descripcion}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="ajuste-bloque">
              <h3 className="ajuste-titulo">Cómo se ve</h3>

              <div className="campo">
                <span className="campo-etiqueta">Color</span>
                <div className="fila-fichas">
                  {PALETAS.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      className={
                        p.slug === estilo.paleta ? "ficha-color elegida" : "ficha-color"
                      }
                      style={{ "--muestra": p.acento }}
                      onClick={() => cambiarEstilo({ paleta: p.slug })}
                      aria-pressed={p.slug === estilo.paleta}
                    >
                      <span className="ficha-color-punto" aria-hidden="true" />
                      {p.nombre}
                    </button>
                  ))}
                </div>
              </div>

              <label className="campo">
                <span>Letra</span>
                <select
                  value={estilo.tipografia}
                  onChange={(e) => cambiarEstilo({ tipografia: e.target.value })}
                >
                  {TIPOGRAFIAS.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.nombre} — {t.ejemplo}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-platillo-fila">
                <label className="campo campo-crece">
                  <span>Aire entre platillos</span>
                  <select
                    value={estilo.densidad}
                    onChange={(e) => cambiarEstilo({ densidad: e.target.value })}
                  >
                    {DENSIDADES.map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.nombre} — {d.descripcion}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="campo campo-crece">
                  <span>Columnas</span>
                  <select
                    value={estilo.columnas}
                    onChange={(e) => cambiarEstilo({ columnas: e.target.value })}
                  >
                    {COLUMNAS.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.nombre} — {c.descripcion}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="eleccion eleccion-sola">
                <input
                  type="checkbox"
                  checked={estilo.destacados}
                  onChange={(e) => cambiarEstilo({ destacados: e.target.checked })}
                />
                <span>
                  <strong>Enseñar lo que te distingue</strong>
                  <em>
                    {destacados.length
                      ? destacados.map((d) => d.text).join(" · ")
                      : "Todavía no escribes ninguna frase. Se ponen en los datos del restaurante."}
                  </em>
                </span>
              </label>

              <label className="eleccion eleccion-sola">
                <input
                  type="checkbox"
                  checked={estilo.iconos}
                  onChange={(e) => cambiarEstilo({ iconos: e.target.checked })}
                />
                <span>
                  <strong>Dibujo junto a cada platillo</strong>
                  <em>
                    Se adivina del nombre —“Hamburguesa” trae la hamburguesa— y
                    lo puedes corregir platillo por platillo más abajo.
                  </em>
                </span>
              </label>

              {admiteMarco(template) ? (
                <label className="eleccion eleccion-sola">
                  <input
                    type="checkbox"
                    checked={estilo.marco}
                    onChange={(e) => cambiarEstilo({ marco: e.target.checked })}
                  />
                  <span>
                    <strong>Marco de madera</strong>
                    <em>El pizarrón colgado, como el de la pared del local.</em>
                  </span>
                </label>
              ) : null}

              <button
                className="btn-texto"
                type="button"
                onClick={() => cambiarEstilo(estiloDeMenu(template, null))}
              >
                Volver a los colores de la plantilla
              </button>
            </div>

            <div className="ajuste-bloque">
              <h3 className="ajuste-titulo">Así se va a ver</h3>
              <p className="ayuda">
                Es tu carta de verdad, con esta plantilla. Guarda para que se
                vea así en tu ficha.
              </p>
              <div className="vista-previa">
                <MenuPintado
                  menu={{ name: nombre, template, grupos: grupos.length ? grupos : MUESTRA }}
                  restaurante={{ name: restaurante.name, linea: restaurante.name }}
                  destacados={destacados}
                  estilo={estilo}
                  Titulo="p"
                  TituloSeccion="p"
                />
              </div>
            </div>
          </>
        ) : null}

        <div className="form-platillo-acciones">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar ajustes"}
          </button>
          {sinCambios ? null : (
            <button
              className="btn-texto"
              type="button"
              onClick={() => setCampos(camposDe(menu))}
            >
              Deshacer los cambios
            </button>
          )}
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
    </section>
  );
}

function camposDe(menu) {
  return {
    nombre: menu.name,
    tipo: menu.kind,
    visible: menu.is_visible,
    template: menu.template,
    estilo: estiloDeMenu(menu.template, menu.style),
  };
}

// La misma firma que la del menú guardado, para saber si queda algo por
// guardar sin comparar campo por campo.
function firmaDeCampos(c) {
  return `${c.nombre}|${c.tipo}|${c.template}|${c.visible}|${JSON.stringify(c.estilo)}`;
}

// La muestra de cada plantilla es la carta de verdad en miniatura, no un
// dibujo: si el diseño cambia, la muestra cambia sola.
function Muestra({ plantilla }) {
  const estilo = estiloDeMenu(plantilla.slug, null);

  return (
    <span
      className={`plantilla-muestra ${clasesDeCarta(plantilla.slug, estilo)}`}
      style={variablesDeEstilo(estilo)}
      aria-hidden="true"
    >
      <span className="carta-tabla">
        <span className="plantilla-muestra-titulo">{plantilla.nombre}</span>
        <span className="plantilla-muestra-linea plantilla-muestra-seccion" />
        <span className="plantilla-muestra-linea" />
        <span className="plantilla-muestra-linea corta" />
        <span className="plantilla-muestra-linea" />
      </span>
    </span>
  );
}
