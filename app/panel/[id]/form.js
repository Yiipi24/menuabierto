"use client";

import { useActionState, useState } from "react";
import { guardarRestaurante, crearCategoria } from "./actions";

const inicial = { status: "idle", message: "" };

const PRECIOS = [
  ["1", "$", "Económico"],
  ["2", "$$", "Medio"],
  ["3", "$$$", "Alto"],
  ["4", "$$$$", "Muy alto"],
];

const DIAS = [
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miércoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sábado"],
  [0, "Domingo"],
];

// La base guarda time (08:00:00) y el input type=time quiere HH:MM.
function aHora(valor) {
  return valor ? String(valor).slice(0, 5) : "";
}

export default function EditarForm({ restaurante, cuisines, elegidas, horarios }) {
  const [state, action, pending] = useActionState(guardarRestaurante, inicial);
  // Las categorías se llevan en estado para que una recién creada quede
  // marcada sola, sin que el dueño tenga que buscarla en la lista.
  const [marcadas, setMarcadas] = useState(() => new Set(elegidas));

  const porDia = new Map(horarios.map((h) => [h.weekday, h]));

  function alternar(slug) {
    setMarcadas((antes) => {
      const copia = new Set(antes);
      if (copia.has(slug)) copia.delete(slug);
      else copia.add(slug);
      return copia;
    });
  }

  return (
    <>
      <form action={action} className="form-alta">
        <input type="hidden" name="id" value={restaurante.id} />

        <label className="campo">
          <span>Nombre del restaurante</span>
          <input
            type="text"
            name="name"
            required
            maxLength={120}
            defaultValue={restaurante.name ?? ""}
          />
        </label>

        <label className="campo">
          <span>En una línea <em>(opcional)</em></span>
          <input
            type="text"
            name="summary"
            maxLength={140}
            defaultValue={restaurante.summary ?? ""}
            placeholder="Tacos al pastor y suadero desde 1998"
          />
        </label>

        <label className="campo">
          <span>Descripción <em>(opcional)</em></span>
          <textarea
            name="description"
            rows={4}
            maxLength={1200}
            defaultValue={restaurante.description ?? ""}
          />
        </label>

        <h2 className="sub">Contacto</h2>

        <div className="campo-par">
          <label className="campo">
            <span>Teléfono</span>
            <input
              type="tel"
              name="phone"
              maxLength={20}
              inputMode="tel"
              defaultValue={restaurante.phone ?? ""}
              placeholder="55 1234 5678"
            />
          </label>
          <label className="campo">
            <span>Sitio o redes <em>(opcional)</em></span>
            <input
              type="text"
              name="website"
              maxLength={200}
              defaultValue={restaurante.website ?? ""}
              placeholder="instagram.com/mirestaurante"
            />
          </label>
        </div>

        <h2 className="sub">Dirección</h2>

        <label className="campo">
          <span>Calle y número <em>(opcional)</em></span>
          <input
            type="text"
            name="street"
            maxLength={140}
            defaultValue={restaurante.street ?? ""}
          />
        </label>

        <div className="campo-par">
          <label className="campo">
            <span>Colonia <em>(opcional)</em></span>
            <input
              type="text"
              name="neighborhood"
              maxLength={80}
              defaultValue={restaurante.neighborhood ?? ""}
            />
          </label>
          <label className="campo">
            <span>Código postal <em>(opcional)</em></span>
            <input
              type="text"
              name="postal_code"
              maxLength={10}
              inputMode="numeric"
              defaultValue={restaurante.postal_code ?? ""}
            />
          </label>
        </div>

        <div className="campo-par">
          <label className="campo">
            <span>Ciudad</span>
            <input
              type="text"
              name="city"
              required
              maxLength={80}
              defaultValue={restaurante.city ?? ""}
            />
          </label>
          <label className="campo">
            <span>Estado <em>(opcional)</em></span>
            <input
              type="text"
              name="state"
              maxLength={80}
              defaultValue={restaurante.state ?? ""}
            />
          </label>
        </div>

        <fieldset className="grupo">
          <legend>Rango de precio</legend>
          <div className="opciones">
            {PRECIOS.map(([valor, simbolo, texto]) => (
              <label className="opcion" key={valor}>
                <input
                  type="radio"
                  name="price_level"
                  value={valor}
                  defaultChecked={String(restaurante.price_level ?? 2) === valor}
                />
                <span className="opcion-cara">
                  <strong>{simbolo}</strong>
                  {texto}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>
            Tipo de comida <em>(puedes elegir varios)</em>
          </legend>
          <div className="chips">
            {cuisines.map((c) => (
              <label className="chip" key={c.slug}>
                <input
                  type="checkbox"
                  name="cuisines"
                  value={c.slug}
                  checked={marcadas.has(c.slug)}
                  onChange={() => alternar(c.slug)}
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>
            Horarios <em>(deja vacío el día que cierras)</em>
          </legend>
          <div className="horarios">
            {DIAS.map(([dia, nombre]) => (
              <div className="horario" key={dia}>
                <span className="horario-dia">{nombre}</span>
                <input
                  type="time"
                  name={`opens_${dia}`}
                  aria-label={`Abre el ${nombre.toLowerCase()}`}
                  defaultValue={aHora(porDia.get(dia)?.opens)}
                />
                <span className="horario-a">a</span>
                <input
                  type="time"
                  name={`closes_${dia}`}
                  aria-label={`Cierra el ${nombre.toLowerCase()}`}
                  defaultValue={aHora(porDia.get(dia)?.closes)}
                />
              </div>
            ))}
          </div>
          <p className="ayuda">
            Si cierras después de medianoche, pon la hora real (por ejemplo, de
            20:00 a 02:00).
          </p>
        </fieldset>

        <button className="btn btn-block" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
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

      <NuevaCategoria
        id={restaurante.id}
        onCreada={(slug) => setMarcadas((antes) => new Set(antes).add(slug))}
      />
    </>
  );
}

// Va fuera del formulario principal: dos <form> anidados no son válidos, y
// crear la categoría no debe guardar el resto de la ficha.
function NuevaCategoria({ id, onCreada }) {
  const [state, action, pending] = useActionState(
    async (prev, formData) => {
      const resultado = await crearCategoria(prev, formData);
      if (resultado.status === "ok" && resultado.slug) onCreada(resultado.slug);
      return resultado;
    },
    inicial,
  );

  return (
    <form action={action} className="categoria-nueva">
      <input type="hidden" name="id" value={id} />
      <label className="campo">
        <span>¿Falta tu tipo de comida? Agrégalo</span>
        <input
          type="text"
          name="nombre"
          maxLength={40}
          placeholder="BBQ, birria, mariscos…"
        />
      </label>
      <button className="btn-texto" type="submit" disabled={pending}>
        {pending ? "Agregando…" : "Agregar categoría"}
      </button>
      {state.status !== "idle" ? (
        <p
          className={state.status === "ok" ? "form-msg ok" : "form-msg err"}
          role={state.status === "ok" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
      <p className="ayuda">
        La categoría queda marcada al crearla; recuerda guardar los cambios.
      </p>
    </form>
  );
}
