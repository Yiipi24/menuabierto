"use client";

import { useActionState, useState, useTransition } from "react";
import { guardarRestaurante, crearCategoria } from "./actions";
import { ESTADOS } from "../../../lib/estados";
import { REDES } from "../../../lib/redes";
import { formasDePagoDe } from "../../../lib/pagos";
import {
  COSTOS_ESTACIONAMIENTO,
  MODOS_DE_SERVICIO,
  TIPOS_ESTACIONAMIENTO,
  serviciosDe,
} from "../../../lib/servicios";
import { IconoRed } from "../../redes-iconos";
import { IconoPago } from "../../pagos-iconos";
import { IconoServicio } from "../../servicios-iconos";
import {
  ICONOS_DESTACADO,
  ICONO_POR_DEFECTO,
  IconoDestacado,
  MAX_DESTACADOS,
} from "../../destacados";

const inicial = { status: "idle", message: "" };

const FORM_ID = "editar-restaurante";

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

const MAX_REDES = 8;

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
  // Los dos catálogos llegan de la base, no de un import: así, uno nuevo
  // aparece en el formulario sin desplegar.
  catalogoServicios,
  catalogoPagos,
  children,
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

  const [destacados, setDestacados] = useState(() => {
    const guardados = Array.isArray(restaurante.highlights) ? restaurante.highlights : [];
    return Array.from({ length: MAX_DESTACADOS }, (_, i) => ({
      icon: guardados[i]?.icon || ICONO_POR_DEFECTO,
      text: guardados[i]?.text || "",
    }));
  });

  const [redes, setRedes] = useState(() => {
    const guardadas = Array.isArray(restaurante.social_links) ? restaurante.social_links : [];
    return guardadas
      .filter((r) => r?.url)
      .map((r) => ({ network: r.network || "otra", url: r.url }));
  });

  // Las formas de pago se llevan en estado para poder pintar la caja marcada
  // completa (icono y todo) y no solo el cuadrito del checkbox.
  const [pagos, setPagos] = useState(
    () => new Set(formasDePagoDe(catalogoPagos, restaurante.payment_methods)),
  );

  const [servicios, setServicios] = useState(
    () => new Set(serviciosDe(catalogoServicios, restaurante.amenities)),
  );
  const [modoServicio, setModoServicio] = useState(restaurante.service_mode ?? "");
  // El costo va aparte del servicio porque es su letra chica: aparece cuando
  // el estacionamiento se marca y desaparece —vacío— cuando se desmarca.
  const [costoEstacionamiento, setCostoEstacionamiento] = useState(
    restaurante.parking_cost ?? "",
  );
  const [tipoEstacionamiento, setTipoEstacionamiento] = useState(
    restaurante.parking_kind ?? "",
  );

  // Los días cerrados se llevan en estado porque apagan sus dos campos de hora
  // en cuanto se marcan, sin esperar al guardado.
  const [cerrados, setCerrados] = useState(
    () => new Set((restaurante.closed_days ?? []).map(Number)),
  );

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

  function alternarPago(slug) {
    setPagos((antes) => {
      const copia = new Set(antes);
      if (copia.has(slug)) copia.delete(slug);
      else copia.add(slug);
      return copia;
    });
  }

  function alternarServicio(slug) {
    setServicios((antes) => {
      const copia = new Set(antes);
      if (copia.has(slug)) copia.delete(slug);
      else copia.add(slug);
      return copia;
    });
    // Quitar el estacionamiento se lleva su costo: dejarlo guardado haría que
    // volver a marcarlo trajera de vuelta un "Gratis" que nadie eligió hoy.
    if (slug === "estacionamiento") {
      setCostoEstacionamiento("");
      setTipoEstacionamiento("");
    }
  }

  function alternarCerrado(dia) {
    setCerrados((antes) => {
      const copia = new Set(antes);
      if (copia.has(dia)) copia.delete(dia);
      else copia.add(dia);
      return copia;
    });
  }

  function cambiarDestacado(i, campo, valor) {
    setDestacados((antes) =>
      antes.map((d, j) => (j === i ? { ...d, [campo]: valor } : d)),
    );
  }

  function cambiarRed(i, campo, valor) {
    setRedes((antes) => antes.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)));
  }

  return (
    <>
      <form action={action} id={FORM_ID} className="form-alta">
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

        <fieldset className="grupo">
          <legend>
            Lo que te distingue <em>(hasta {MAX_DESTACADOS} frases con icono)</em>
          </legend>
          <p className="ayuda">
            Salen junto al nombre en tu ficha. Escríbelas cortas: "Ahumados al
            estilo BBQ", "Cocción lenta 14+ horas".
          </p>
          <div className="destacados-edicion">
            {destacados.map((d, i) => (
              <div className="destacado-fila" key={i}>
                <span className="destacado-muestra" aria-hidden="true">
                  <IconoDestacado slug={d.icon} ancho={22} />
                </span>
                <label className="destacado-icono">
                  <span className="sr-only">Icono del destacado {i + 1}</span>
                  <select
                    name={`highlight_icon_${i}`}
                    value={d.icon}
                    onChange={(e) => cambiarDestacado(i, "icon", e.target.value)}
                  >
                    {ICONOS_DESTACADO.map(([slug, nombre]) => (
                      <option value={slug} key={slug}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="destacado-texto">
                  <span className="sr-only">Texto del destacado {i + 1}</span>
                  <input
                    type="text"
                    name={`highlight_text_${i}`}
                    maxLength={60}
                    value={d.text}
                    onChange={(e) => cambiarDestacado(i, "text", e.target.value)}
                    placeholder={
                      i === 0
                        ? "Ahumados al estilo BBQ"
                        : i === 1
                          ? "Brisket y pulled pork"
                          : "Cocción lenta 14+ horas"
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <h2 className="sub">Contacto</h2>

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

        <fieldset className="grupo">
          <legend>
            Sitio o redes <em>(opcional)</em>
          </legend>

          <label className="campo">
            <span>Página web</span>
            <input
              type="text"
              name="website"
              maxLength={200}
              defaultValue={restaurante.website ?? ""}
              placeholder="mirestaurante.com"
            />
          </label>

          <div className="redes-edicion">
            {redes.map((r, i) => (
              <div className="red-fila" key={i}>
                {/* El logo cambia con el select: sin él las ocho filas se ven
                    iguales y hay que leerlas una por una. */}
                <span className={`red-logo red-${r.network}`}>
                  <IconoRed slug={r.network} ancho={20} />
                </span>
                <label className="red-tipo">
                  <span className="sr-only">Red social {i + 1}</span>
                  <select
                    name={`social_network_${i}`}
                    value={r.network}
                    onChange={(e) => cambiarRed(i, "network", e.target.value)}
                  >
                    {REDES.map((red) => (
                      <option value={red.slug} key={red.slug}>
                        {red.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="red-liga">
                  <span className="sr-only">Enlace de la red {i + 1}</span>
                  <input
                    type="text"
                    name={`social_url_${i}`}
                    maxLength={200}
                    value={r.url}
                    onChange={(e) => cambiarRed(i, "url", e.target.value)}
                    placeholder="instagram.com/mirestaurante"
                  />
                </label>
                <button
                  className="btn-texto"
                  type="button"
                  onClick={() => setRedes((antes) => antes.filter((_, j) => j !== i))}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          {redes.length < MAX_REDES ? (
            <button
              className="btn btn-chico"
              type="button"
              onClick={() =>
                setRedes((antes) => [...antes, { network: "instagram", url: "" }])
              }
            >
              Agregar red social
            </button>
          ) : (
            <p className="ayuda">Ya son {MAX_REDES} enlaces: es el máximo.</p>
          )}
        </fieldset>

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
            <span>Estado</span>
            <select name="state" required defaultValue={restaurante.state ?? ""}>
              <option value="" disabled>
                Elige tu estado
              </option>
              {ESTADOS.map((estado) => (
                <option value={estado} key={estado}>
                  {estado}
                </option>
              ))}
            </select>
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
            Formas de pago <em>(marca todas las que aceptes)</em>
          </legend>
          <p className="ayuda">
            Es de lo que más te preguntan por teléfono. Sale en tu ficha, así
            que el comensal llega sabiendo si trae efectivo o no.
          </p>
          <div className="pagos-edicion">
            {catalogoPagos.map((forma) => (
              <label className="pago-opcion" key={forma.slug}>
                <input
                  type="checkbox"
                  name="payment_methods"
                  value={forma.slug}
                  checked={pagos.has(forma.slug)}
                  onChange={() => alternarPago(forma.slug)}
                />
                <span className="pago-cara">
                  <IconoPago slug={forma.icono} ancho={22} />
                  <span className="pago-texto">
                    <strong>{forma.nombre}</strong>
                    <em>{forma.pista}</em>
                  </span>
                </span>
              </label>
            ))}
          </div>
          {pagos.size === 0 ? (
            <p className="ayuda">
              Si no marcas ninguna, tu ficha seguirá diciendo que hay que
              confirmarlo con ustedes.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="grupo">
          <legend>
            Servicios <em>(cómo se sirve y qué hay en el local)</em>
          </legend>
          <p className="ayuda">
            Se pregunta antes de salir de casa, igual que la forma de pago.
          </p>

          {/* Va arriba y como una sola respuesta: las tres se excluyen entre
              sí, y es lo primero que decide si alguien va o no. */}
          <div className="servicio-detalle servicio-detalle-primero">
            <span className="servicio-detalle-titulo">¿Cómo se sirve?</span>
            <div className="chips">
              <label className="chip">
                <input
                  type="radio"
                  name="service_mode"
                  value=""
                  checked={modoServicio === ""}
                  onChange={() => setModoServicio("")}
                />
                <span>No lo digo</span>
              </label>
              {MODOS_DE_SERVICIO.map((modo) => (
                <label className="chip" key={modo.slug}>
                  <input
                    type="radio"
                    name="service_mode"
                    value={modo.slug}
                    checked={modoServicio === modo.slug}
                    onChange={() => setModoServicio(modo.slug)}
                  />
                  <span>{modo.nombre}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="servicios-edicion">
            {catalogoServicios.map((servicio) => (
              <label className="servicio-opcion" key={servicio.slug}>
                <input
                  type="checkbox"
                  name="amenities"
                  value={servicio.slug}
                  checked={servicios.has(servicio.slug)}
                  onChange={() => alternarServicio(servicio.slug)}
                />
                <span className="servicio-cara">
                  <IconoServicio slug={servicio.icono} ancho={22} />
                  <span className="servicio-texto">
                    <strong>{servicio.nombre}</strong>
                    <em>{servicio.pista}</em>
                  </span>
                </span>
              </label>
            ))}
          </div>

          {/* Sale solo cuando hay estacionamiento: es su letra chica, y
              preguntar el costo de algo que no existe no tiene sentido. */}
          {/* Las dos preguntas del estacionamiento: dónde se deja el carro y
              cómo se paga. Son independientes —hay estacionamiento propio de
              paga y calle gratis— y las dos salen solo si hay estacionamiento. */}
          {servicios.has("estacionamiento") ? (
            <div className="servicio-detalle">
              <span className="servicio-detalle-titulo">
                ¿Dónde se estaciona?
              </span>
              <div className="chips">
                <label className="chip">
                  <input
                    type="radio"
                    name="parking_kind"
                    value=""
                    checked={tipoEstacionamiento === ""}
                    onChange={() => setTipoEstacionamiento("")}
                  />
                  <span>No lo digo</span>
                </label>
                {TIPOS_ESTACIONAMIENTO.map((tipo) => (
                  <label className="chip" key={tipo.slug}>
                    <input
                      type="radio"
                      name="parking_kind"
                      value={tipo.slug}
                      checked={tipoEstacionamiento === tipo.slug}
                      onChange={() => setTipoEstacionamiento(tipo.slug)}
                    />
                    <span>{tipo.nombre}</span>
                  </label>
                ))}
              </div>

              <span className="servicio-detalle-titulo servicio-detalle-segundo">
                ¿Cómo se paga el estacionamiento?
              </span>
              <div className="chips">
                <label className="chip">
                  <input
                    type="radio"
                    name="parking_cost"
                    value=""
                    checked={costoEstacionamiento === ""}
                    onChange={() => setCostoEstacionamiento("")}
                  />
                  <span>No lo digo</span>
                </label>
                {COSTOS_ESTACIONAMIENTO.map((costo) => (
                  <label className="chip" key={costo.slug}>
                    <input
                      type="radio"
                      name="parking_cost"
                      value={costo.slug}
                      checked={costoEstacionamiento === costo.slug}
                      onChange={() => setCostoEstacionamiento(costo.slug)}
                    />
                    <span>{costo.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
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

          {/* Va aquí, pegada a la lista, porque es la respuesta a mirarla y no
              encontrar lo tuyo. No es un <form> propio: dos formularios
              anidados no son válidos, así que llama a la acción a mano. */}
          <NuevaCategoria
            id={restaurante.id}
            onCreada={(slug) => setMarcadas((antes) => new Set(antes).add(slug))}
          />
        </fieldset>

        <fieldset className="grupo">
          <legend>
            Horarios <em>(marca el día que cierras)</em>
          </legend>
          <div className="horarios">
            {DIAS.map(([dia, nombre]) => {
              const cerrado = cerrados.has(dia);
              return (
                <div className={cerrado ? "horario horario-cerrado" : "horario"} key={dia}>
                  <label className="horario-cierre">
                    <input
                      type="checkbox"
                      name="closed_days"
                      value={dia}
                      checked={cerrado}
                      onChange={() => alternarCerrado(dia)}
                    />
                    <span>Cerrado</span>
                  </label>
                  <span className="horario-dia">{nombre}</span>
                  <input
                    type="time"
                    name={`opens_${dia}`}
                    aria-label={`Abre el ${nombre.toLowerCase()}`}
                    defaultValue={aHora(porDia.get(dia)?.opens)}
                    disabled={cerrado}
                  />
                  <span className="horario-a">a</span>
                  <input
                    type="time"
                    name={`closes_${dia}`}
                    aria-label={`Cierra el ${nombre.toLowerCase()}`}
                    defaultValue={aHora(porDia.get(dia)?.closes)}
                    disabled={cerrado}
                  />
                </div>
              );
            })}
          </div>
          <p className="ayuda">
            Si cierras después de medianoche, pon la hora real (por ejemplo, de
            20:00 a 02:00).
          </p>
        </fieldset>
      </form>

      {children}

      {/* El botón vive fuera del formulario y lo manda por su id: así el
          guardado queda al final de la página, después de los menús y las
          fotos, y no a media edición. */}
      <div className="guardar-final">
        <button className="btn btn-block" type="submit" form={FORM_ID} disabled={pending}>
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
      </div>
    </>
  );
}

// La acción se llama a mano, sin <form>, porque este bloque vive dentro del
// formulario grande: crear la categoría no debe guardar el resto de la ficha.
function NuevaCategoria({ id, onCreada }) {
  const [nombre, setNombre] = useState("");
  const [aviso, setAviso] = useState(inicial);
  const [enviando, empezar] = useTransition();

  function agregar() {
    const datos = new FormData();
    datos.set("id", id);
    datos.set("nombre", nombre);
    empezar(async () => {
      const resultado = await crearCategoria(inicial, datos);
      setAviso(resultado);
      if (resultado.status === "ok" && resultado.slug) {
        onCreada(resultado.slug);
        setNombre("");
      }
    });
  }

  return (
    <div className="categoria-nueva">
      <label className="campo">
        <span>¿Falta tu tipo de comida? Agrégalo</span>
        <input
          type="text"
          value={nombre}
          maxLength={40}
          placeholder="BBQ, birria, mariscos…"
          onChange={(e) => setNombre(e.target.value)}
          // Enter dentro del campo mandaría el formulario grande; aquí solo
          // agrega la categoría, que es lo que la persona está haciendo.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
        />
      </label>
      <button className="btn-texto" type="button" onClick={agregar} disabled={enviando}>
        {enviando ? "Agregando…" : "Agregar categoría"}
      </button>
      {aviso.status !== "idle" ? (
        <p
          className={aviso.status === "ok" ? "form-msg ok" : "form-msg err"}
          role={aviso.status === "ok" ? "status" : "alert"}
        >
          {aviso.message}
        </p>
      ) : null}
      <p className="ayuda">
        La categoría queda marcada al crearla; recuerda guardar los cambios.
      </p>
    </div>
  );
}
