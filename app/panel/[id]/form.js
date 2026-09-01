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

export default function EditarForm({
  restaurante,
  cuisines,
  elegidas,
  horarios,
  coords,
}) {
  const [state, action, pending] = useActionState(guardarRestaurante, inicial);
  // Las categorías se llevan en estado para que una recién creada quede
  // marcada sola, sin que el dueño tenga que buscarla en la lista.
  const [marcadas, setMarcadas] = useState(() => new Set(elegidas));
  // Las coordenadas se llevan en estado porque hay tres formas de llenarlas
  // (a mano, pegando el par de Google Maps, o con el botón de ubicación) y
  // las tres tienen que escribir en los mismos dos campos.
  const [punto, setPunto] = useState(() => ({
    lat: coords?.lat != null ? String(coords.lat) : "",
    lng: coords?.lng != null ? String(coords.lng) : "",
  }));
  const [ubicando, setUbicando] = useState(false);
  const [avisoPunto, setAvisoPunto] = useState("");

  const porDia = new Map(horarios.map((h) => [h.weekday, h]));

  // De Google Maps se copia "25.79000, -100.31500" de una pieza. Si eso cae en
  // el campo de latitud, se reparte solo en vez de obligar a recortarlo. Pero
  // en español la coma es también el separador decimal, y "25,79" es una sola
  // latitud: repartirla mandaría el restaurante a miles de kilómetros, y sin
  // avisar. Solo se separa cuando la coma no puede ser decimal.
  function separarPar(valor) {
    const partes = valor.split(",");
    if (partes.length !== 2) return null;
    const izq = partes[0].trim();
    const der = partes[1].trim();
    if (izq === "" || der === "") return null;
    // Detrás de una coma decimal no va un signo ni un espacio, y una pieza que
    // ya trae punto decimal no está usando la coma para decimales.
    const esPar =
      /^[+-]/.test(der) || izq.includes(".") || der.includes(".") || /,\s/.test(valor);
    return esPar ? { lat: izq, lng: der } : null;
  }

  function escribirLat(valor) {
    const par = separarPar(valor);
    if (par) {
      setPunto(par);
      return;
    }
    setPunto((antes) => ({ ...antes, lat: valor }));
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setAvisoPunto("Tu navegador no comparte la ubicación. Escribe las coordenadas a mano.");
      return;
    }
    setAvisoPunto("");
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicando(false);
        // Cinco decimales son alrededor de un metro: de sobra para un local, y
        // más cifras solo dan una precisión que el GPS del teléfono no tiene.
        setPunto({
          lat: pos.coords.latitude.toFixed(5),
          lng: pos.coords.longitude.toFixed(5),
        });
        setAvisoPunto("Coordenadas puestas. Guarda los cambios para conservarlas.");
      },
      () => {
        setUbicando(false);
        setAvisoPunto("No pudimos obtener tu ubicación. Escribe las coordenadas a mano.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

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

        {/* La ubicación se calcula sola desde la dirección de arriba, así que
            estos campos van plegados: el dueño no tiene por qué copiar
            coordenadas de ningún lado. Quedan para el caso en que el
            geocodificador se equivoque, que en colonias nuevas pasa. */}
        <details className="avanzado">
          <summary>Ubicación exacta <em>(opcional)</em></summary>

          <p className="campo-pista">
            Si dejas esto vacío calculamos el punto solo, a partir de la
            dirección, al guardar. Llénalo únicamente si el mapa te ubica mal.
          </p>

          <div className="campo-par">
            <label className="campo">
              <span>Latitud</span>
              <input
                type="text"
                name="lat"
                inputMode="decimal"
                maxLength={24}
                value={punto.lat}
                onChange={(e) => escribirLat(e.target.value)}
                placeholder="25.79000"
              />
            </label>
            <label className="campo">
              <span>Longitud</span>
              <input
                type="text"
                name="lng"
                inputMode="decimal"
                maxLength={24}
                value={punto.lng}
                onChange={(e) => setPunto((antes) => ({ ...antes, lng: e.target.value }))}
                placeholder="-100.31500"
              />
            </label>
          </div>

          <div className="campo-acciones">
            <button
              className="btn btn-chico"
              type="button"
              onClick={usarMiUbicacion}
              disabled={ubicando}
            >
              {ubicando ? "Buscando…" : "Usar mi ubicación actual"}
            </button>
            {punto.lat || punto.lng ? (
              <button
                className="btn-texto"
                type="button"
                onClick={() => {
                  setPunto({ lat: "", lng: "" });
                  setAvisoPunto("");
                }}
              >
                Vaciar
              </button>
            ) : null}
          </div>

          <p className="campo-pista">
            {avisoPunto ||
              "Ábrelo desde el local para tomar el punto exacto, o pega aquí el par de números de Google Maps."}
          </p>

          <p className="campo-credito">
            La ubicación automática se calcula con{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
            .
          </p>
        </details>

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
