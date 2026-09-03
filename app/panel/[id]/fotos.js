"use client";

import { useActionState, useRef } from "react";
import { subirFotos, borrarFoto } from "./actions";
import { MAX_FOTO_BYTES, TIPOS_FOTO, revisarArchivos } from "../../../lib/subidas";

const inicial = { status: "idle", message: "" };

export default function Fotos({ id, fotos, cupoPlatillos }) {
  const fachada = fotos.filter((f) => f.category === "fachada");
  const platillos = fotos.filter((f) => f.category === "platillo");
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
      />

      <GrupoFotos
        id={id}
        categoria="platillo"
        titulo="Fotos de platillos"
        pista={`Hasta ${cupoPlatillos} con tu plan. Con un plan mayor caben más.`}
        fotos={platillos}
        cupo={cupoPlatillos}
        multiple
      />

      {otras.length ? (
        <div className="grupo-fotos">
          <h3 className="grupo-fotos-titulo">Otras fotos</h3>
          <p className="ayuda">
            Las que subiste antes de separarlas por tipo. Siguen saliendo en la
            galería de tu ficha.
          </p>
          <Galeria id={id} fotos={otras} />
        </div>
      ) : null}
    </section>
  );
}

function GrupoFotos({ id, categoria, titulo, pista, fotos, cupo, multiple = false }) {
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
        <Galeria id={id} fotos={fotos} />
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

function Galeria({ id, fotos }) {
  return (
    <ul className="galeria">
      {fotos.map((f) => (
        <li key={f.id} className="galeria-foto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={f.alt ?? ""} loading="lazy" />
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
  );
}
