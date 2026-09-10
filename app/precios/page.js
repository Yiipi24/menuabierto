import Link from "next/link";
import Nav from "../nav";
import BotonCerca from "./cerca";
import { supabaseServer } from "../../lib/supabase";
import { pesos } from "../../lib/precios";
import { rangoLegible, topeEnCentavos } from "../../lib/inteligencia-precios";
import { rutaFicha, rutaMenuCarta } from "../../lib/slug";
import { distancia } from "../tarjeta";

export const metadata = {
  title: "¿Cuánto cuesta comer? Busca por precio de platillo — Menú Abierto",
  description:
    "Quién vende tacos al pastor a menos de treinta pesos cerca de ti, y cuánto cuesta comer en tu colonia, con los precios de verdad de cada carta.",
};

// La búsqueda se resuelve en cada visita: depende de lo que escriba cada
// quien y de dónde esté.
export const dynamic = "force-dynamic";

const RADIO_M = 5000;

// Buscar por precio de platillo, no solo por nivel de precio.
//
// Es lo que nadie más puede ofrecer: Google guarda el menú como PDF y aquí
// cada platillo tiene su precio en centavos. La página contesta dos preguntas:
// quién vende tal cosa a menos de tanto cerca de mí, y cuánto cuesta comer en
// una zona. Las dos salen de las cartas publicadas y visibles, nada más.
export default async function Precios({ searchParams }) {
  const sp = await searchParams;
  const platillo = typeof sp.platillo === "string" ? sp.platillo.trim().slice(0, 60) : "";
  const lugar = typeof sp.lugar === "string" ? sp.lugar.trim().slice(0, 80) : "";
  const maxTexto = typeof sp.max === "string" ? sp.max.trim().slice(0, 12) : "";
  const max = topeEnCentavos(maxTexto);
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const conUbicacion = Number.isFinite(lat) && Number.isFinite(lng) && sp.lat && sp.lng;

  const buscando = platillo.length >= 2;
  let resultados = [];
  let zona = null;
  let fallo = false;

  if (buscando || lugar) {
    try {
      const supabase = supabaseServer();
      const [platillos, resumen] = await Promise.all([
        buscando
          ? supabase.rpc("platillos_cerca", {
              p_termino: platillo,
              p_lat: conUbicacion ? lat : null,
              p_lng: conUbicacion ? lng : null,
              p_radio_m: RADIO_M,
              p_lugar: lugar || null,
              p_max_cents: max,
              p_limite: 40,
            })
          : Promise.resolve({ data: [] }),
        lugar ? supabase.rpc("precios_de_zona", { p_lugar: lugar }) : Promise.resolve({ data: null }),
      ]);
      if (platillos.error) fallo = true;
      resultados = platillos.data ?? [];
      const fila = Array.isArray(resumen.data) ? resumen.data[0] : resumen.data;
      zona = fila ?? null;
    } catch {
      fallo = true;
    }
  }

  const titulo = buscando
    ? `${platillo}${max ? ` a menos de ${pesos(max)}` : ""}${lugar ? ` en ${lugar}` : conUbicacion ? " cerca de ti" : ""}`
    : lugar
      ? `Cuánto cuesta comer en ${lugar}`
      : "Busca por precio de platillo";

  return (
    <>
      <Nav />
      <main className="wrap panel-main">
        <h1>{titulo}</h1>
        <p className="panel-lead">
          Los precios de verdad de cada carta, no un rango de signos de pesos. Escribe qué se
          te antoja, hasta cuánto quieres pagar y dónde.
        </p>

        <form id="form-precios" method="get" className="form-precios" action="/precios">
          <input type="hidden" name="lat" defaultValue={conUbicacion ? lat : ""} />
          <input type="hidden" name="lng" defaultValue={conUbicacion ? lng : ""} />
          <label className="campo campo-crece">
            <span>Platillo</span>
            <input type="text" name="platillo" defaultValue={platillo} placeholder="tacos al pastor, ramen, chilaquiles…" minLength={2} maxLength={60} />
          </label>
          <label className="campo">
            <span>Hasta</span>
            <input type="text" name="max" inputMode="decimal" defaultValue={maxTexto} placeholder="$30" maxLength={12} />
          </label>
          <label className="campo campo-crece">
            <span>Dónde</span>
            <input type="text" name="lugar" defaultValue={lugar} placeholder="Coyoacán, Monterrey, 64000…" maxLength={80} />
          </label>
          <div className="form-precios-acciones">
            <button className="btn" type="submit">Buscar</button>
            <BotonCerca />
          </div>
        </form>

        {zona ? (
          <section className="precios-zona" aria-label={`Precios en ${lugar}`}>
            {zona.mediana_cents != null ? (
              <>
                <h2>Comer en {lugar} cuesta alrededor de <b>{pesos(zona.mediana_cents)}</b> por platillo</h2>
                <p>
                  Lo típico va de {rangoLegible(zona.p25_cents, zona.p75_cents)}: es la mediana de {zona.restaurantes}{" "}
                  restaurantes con carta publicada ({zona.platillos} platillos con precio).
                </p>
              </>
            ) : (
              <p className="ayuda">
                {zona.restaurantes
                  ? `Todavía hay pocos restaurantes con carta en ${lugar} (${zona.restaurantes}) para decir cuánto cuesta comer ahí sin señalar a nadie.`
                  : `No encontramos restaurantes con carta publicada en ${lugar}.`}
              </p>
            )}
          </section>
        ) : null}

        {fallo ? (
          <p className="form-msg err" role="alert">No pudimos buscar ahora. Inténtalo otra vez.</p>
        ) : null}

        {buscando ? (
          resultados.length ? (
            <ol className="precios-lista">
              {resultados.map((r) => (
                <li key={r.restaurant_id} className="precios-fila">
                  <div className="precios-fila-texto">
                    <Link className="precios-fila-platillo" href={rutaMenuCarta(r.slug, r.menu_id)}>
                      {r.item_name}
                    </Link>
                    <span className="precios-fila-donde">
                      <Link href={rutaFicha(r.slug)}>{r.name}</Link>
                      {[r.neighborhood, r.city].filter(Boolean).length ? ` · ${[r.neighborhood, r.city].filter(Boolean).join(", ")}` : ""}
                      {r.distance_m != null ? ` · ${distancia(r.distance_m)}` : ""}
                    </span>
                  </div>
                  <strong className="precios-fila-precio">{pesos(r.price_cents, r.currency?.trim() || "MXN")}</strong>
                </li>
              ))}
            </ol>
          ) : !fallo ? (
            <div className="vacio">
              <h2>Nadie vende eso {max ? `a menos de ${pesos(max)}` : "todavía"}{lugar ? ` en ${lugar}` : ""}</h2>
              <p>Prueba con otro nombre, sube el tope, o busca en una zona más grande.</p>
            </div>
          ) : null
        ) : null}

        <p className="ayuda precios-nota">
          Solo aparecen cartas publicadas y visibles, con su precio tal como lo capturó el restaurante. Un precio puede ir
          hasta una hora por detrás de la cocina. <Link href="/">Volver a la búsqueda</Link>
        </p>
      </main>
    </>
  );
}
