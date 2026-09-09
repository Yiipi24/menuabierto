"use client";

import { useActionState, useRef, useState } from "react";
import { subirFotos, borrarFoto, editarFoto } from "./actions";
import { MAX_FOTO_BYTES, TIPOS_FOTO, revisarArchivos } from "../../../lib/subidas";
import Modal from "../modal";

const inicial = { status: "idle", message: "" };

// Las etiquetas que se sugieren al escribir; el dueño puede poner la suya.
const ETIQUETAS = ["Especialidad", "Para compartir", "Favorito", "Nuevo", "De temporada"];

export default function Fotos({ id, fotos, cupoPlatillos, platillos = [] }) {
  const fachada = fotos.filter((f) => f.category === "fachada");
  const deplatillos = fotos.filter((f) => f.category === "platillo");
  // Las fotos que se subieron antes de que existieran los papeles. Se siguen
  // viendo y se pueden borrar, pero ya no se agregan más sin decir qué son.
  const otras = fotos.filter((f) => f.category !== "fachada" && f.category !== "platillo");

  return (
    <section className="bloque-fotos">
      <h2 className="sub">Fotos del restaurante</h2>
      <p className="ayuda">
        JPG, PNG o WebP, hasta 5 MB cada una.
      </p>

      <GrupoFotos
        id={id}
        categoria="fachada"
        titulo="Foto del restaurante, parte frontal"
        pista="La fachada: es la que se ve en el directorio y encabeza tu ficha."
        fotos={fachada}
        cupo={1}
        platillos={platillos}
      />

      <GrupoFotos
        id={id}
        categoria="platillo"
        titulo="Fotos de platillos"
        pista={`Hasta ${cupoPlatillos} con tu plan. Con un plan mayor caben más. Ponles nombre y marca hasta tres como favoritas: son las que salen grandes en "Favoritos de la casa".`}
        fotos={deplatillos}
        cupo={cupoPlatillos}
        platillos={platillos}
        multiple
      />

      {otras.length ? (
        <div className="grupo-fotos">
          <h3 className="grupo-fotos-titulo">Otras fotos</h3>
          <p className="ayuda">
            Las que subiste antes de separarlas por tipo. Siguen saliendo en la
            galería de tu ficha.
          </p>
          <Galeria id={id} fotos={otras} platillos={platillos} />
        </div>
      ) : null}
    </section>
  );
}

function GrupoFotos({ id, categoria, titulo, pista, fotos, cupo, platillos, multiple = false }) {
  const entrada = useRef(null);
  const [state, action, pending] = useActionState(
    async (prev, formData) => {
      const archivos = formData.getAll("fotos").filter((f) => f && f.size > 0);
      // Se revisa aquí antes de mandar: una foto de más de 5 MB reventaría la
      // petición entera y con ella la página, borrando lo que la persona
      // llevara escrito en la ficha.
      const aviso = revisarArchivos(archivos, {
        tipos: TIPOS_FOTO,
        maxBytes: MAX_FOTO_BYTES,
        queEs: "la foto",
      });
      if (aviso) return { status: "error", message: aviso };

      try {
        const resultado = await subirFotos(prev, formData);
        // Vaciar el input tras subir evita mandar dos veces las mismas fotos.
        if (resultado.status === "ok" && entrada.current) entrada.current.value = "";
        return resultado;
      } catch (error) {
        // Cualquier fallo de la subida se queda aquí: dejarlo subir llevaría a
        // la pantalla de error y a perder el resto del formulario.
        console.error("subir fotos", error);
        return {
          status: "error",
          message: "No pudimos subir la foto. Revisa tu conexión e inténtalo otra vez.",
        };
      }
    },
    inicial,
  );

  const lleno = fotos.length >= cupo;

  return (
    <div className="grupo-fotos">
      <div className="grupo-fotos-cabeza">
        <h3 className="grupo-fotos-titulo">{titulo}</h3>
        <span className="cupo">
          {fotos.length} de {cupo}
        </span>
      </div>
      <p className="ayuda">{pista}</p>

      {fotos.length ? (
        <Galeria id={id} fotos={fotos} platillos={platillos} />
      ) : (
        <p className="nota-borrador">Todavía no hay ninguna.</p>
      )}

      {lleno ? (
        <p className="ayuda">
          {categoria === "fachada"
            ? "Ya tienes tu fachada. Bórrala para poner otra."
            : "Llegaste al máximo de tu plan. Borra alguna o mejora tu plan."}
        </p>
      ) : (
        <form action={action} className="form-fotos">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="categoria" value={categoria} />
          <label className="campo">
            <span className="sr-only">Agregar {titulo.toLowerCase()}</span>
            <input
              ref={entrada}
              type="file"
              name="fotos"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple={multiple}
            />
          </label>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Subiendo…" : "Subir"}
          </button>
        </form>
      )}

      {state.status !== "idle" ? (
        <p
          className={state.status === "ok" ? "form-msg ok" : "form-msg err"}
          role={state.status === "ok" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function Galeria({ id, fotos, platillos }) {
  const [editando, setEditando] = useState(null);

  return (
    <>
      <ul className="galeria">
        {fotos.map((f) => (
          <li key={f.id} className={f.is_visible === false ? "galeria-foto es-oculta" : "galeria-foto"}>
            <img src={f.url} alt={f.alt ?? ""} loading="lazy" />
            {f.dish_name ? (
              <span className="galeria-nombre">
                {f.is_featured ? <em>★</em> : null}
                {f.dish_name}
              </span>
            ) : null}
            {f.is_visible === false ? <span className="galeria-oculta">Oculta</span> : null}
            <button
              type="button"
              className="galeria-editar"
              onClick={() => setEditando(f)}
              aria-label={f.dish_name ? `Editar ${f.dish_name}` : "Editar foto"}
            >
              Editar
            </button>
            <form action={borrarFoto}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="foto" value={f.id} />
              <button className="galeria-borrar" type="submit" aria-label="Borrar foto">
                ×
              </button>
            </form>
          </li>
        ))}
      </ul>

      <Modal
        abierto={Boolean(editando)}
        alCerrar={() => setEditando(null)}
        titulo="Datos de la foto"
        descripcion="Lo que escribas aquí sale en tu ficha: el nombre en la franja de la foto, y el resto al abrirla."
      >
        {editando ? (
          <FormFoto
            key={editando.id}
            id={id}
            foto={editando}
            platillos={platillos}
            alGuardar={() => setEditando(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}

function FormFoto({ id, foto, platillos, alGuardar }) {
  const [state, action, pending] = useActionState(async (prev, formData) => {
    try {
      const r = await editarFoto(prev, formData);
      if (r.status === "ok") alGuardar();
      return r;
    } catch (error) {
      console.error("editar foto", error);
      return { status: "error", message: "No pudimos guardar los cambios. Inténtalo otra vez." };
    }
  }, inicial);

  return (
    <form action={action} className="form-foto">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="foto" value={foto.id} />

      <img className="form-foto-vista" src={foto.url} alt="" />

      <label className="campo">
        <span>Nombre del platillo</span>
        <input
          type="text"
          name="dishName"
          defaultValue={foto.dish_name ?? ""}
          maxLength={80}
          placeholder="Brisket"
        />
        <small className="ayuda">Sin nombre, la foto se enseña sin franja.</small>
      </label>

      <div className="campo-par">
        <label className="campo">
          <span>Etiqueta</span>
          <input
            type="text"
            name="dishLabel"
            list={`etiquetas-${foto.id}`}
            defaultValue={foto.dish_label ?? ""}
            maxLength={40}
            placeholder="Especialidad"
          />
          <datalist id={`etiquetas-${foto.id}`}>
            {ETIQUETAS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </label>

        <label className="campo">
          <span>Orden</span>
          <input
            type="number"
            name="displayOrder"
            min={0}
            max={999}
            step={1}
            defaultValue={foto.position ?? 0}
          />
        </label>
      </div>

      <label className="campo">
        <span>Descripción</span>
        <textarea
          name="description"
          rows={3}
          maxLength={400}
          defaultValue={foto.description ?? ""}
          placeholder="Doce horas de humo de mezquite, con su corteza de pimienta."
        />
      </label>

      <label className="campo">
        <span>Platillo de tu carta</span>
        <select name="menuItemId" defaultValue={foto.menu_item_id ?? ""}>
          <option value="">Ninguno</option>
          {platillos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {p.carta ? ` · ${p.carta}` : ""}
            </option>
          ))}
        </select>
        <small className="ayuda">Con él, la foto enseña su precio y un botón para verlo en el menú.</small>
      </label>

      <label className="campo">
        <span>Texto alternativo</span>
        <input
          type="text"
          name="altText"
          defaultValue={foto.alt ?? ""}
          maxLength={200}
          placeholder="Rebanadas de brisket sobre papel encerado"
        />
        <small className="ayuda">Lo que lee un lector de pantalla en lugar de la foto.</small>
      </label>

      <label className="casilla">
        <input type="checkbox" name="isFeatured" defaultChecked={Boolean(foto.is_featured)} />
        <span>Destacada en &ldquo;Favoritos de la casa&rdquo;</span>
      </label>

      <label className="casilla">
        <input type="checkbox" name="isVisible" defaultChecked={foto.is_visible !== false} />
        <span>Mostrar en la ficha</span>
      </label>

      {state.status === "error" ? (
        <p className="form-msg err" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="modal-botones">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
