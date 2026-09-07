import Link from "next/link";
import { rutaFicha, rutaMenu } from "../lib/slug";
import { iconoCocina, tonoCocina } from "./cocinas";
import Favorito from "./favorito";

// La tarjeta de un restaurante en una lista. La dibujaba la portada dentro de
// su propio `map`, y ahora la enseñan también las páginas de /comida: una
// tarjeta escrita dos veces son dos tarjetas que se van pareciendo cada vez
// menos.

export const PRECIO = ["", "$", "$$", "$$$", "$$$$"];

export function distancia(metros) {
  if (metros == null) return null;
  return metros < 950 ? `${Math.round(metros / 10) * 10} m` : `${(metros / 1000).toFixed(1)} km`;
}

export function lugarDe(r) {
  return [r.neighborhood, r.city].filter(Boolean).join(" · ");
}

// Las estrellas dibujadas, que es como se lee una calificación de un vistazo.
// El número va al lado igual: redondear a estrellas enteras es una
// aproximación, y quien compara dos restaurantes quiere el 4.7 exacto.
export function estrellas(promedio) {
  const llenas = Math.round(Number(promedio));
  return "★★★★★".slice(0, llenas) + "☆☆☆☆☆".slice(0, 5 - llenas);
}

export default function Tarjeta({ r, slugCocina, guardado = false }) {
  const icono = iconoCocina(slugCocina);
  const lejos = distancia(r.distance_m);

  return (
    <article className="tarjeta" style={{ "--categoria-tono": tonoCocina(slugCocina) }}>
      <div className="tarjeta-foto">
        {r.foto ? (
          <img src={r.foto} alt="" loading="lazy" />
        ) : (
          <span className="tarjeta-sinfoto" aria-hidden="true">
            {icono}
          </span>
        )}
        {r.is_open_now ? <span className="insignia-abierto">Abierto ahora</span> : null}
        {lejos ? <span className="insignia-lejos">{lejos}</span> : null}
      </div>

      <Favorito restauranteId={r.id} nombre={r.name} guardado={guardado} />

      <div className="tarjeta-cuerpo">
        <div className="tarjeta-titulo">
          <h3>
            <Link className="tarjeta-enlace" href={rutaFicha(r.slug)}>
              {r.name}
            </Link>
          </h3>
          {r.price_level ? <span className="tarjeta-precio">{PRECIO[r.price_level]}</span> : null}
        </div>

        {r.rating_count > 0 && r.rating_avg ? (
          <p className="tarjeta-estrellas">
            <span className="tarjeta-estrellas-marca" aria-hidden="true">
              {estrellas(r.rating_avg)}
            </span>
            <b>{r.rating_avg}</b>
            <span>
              ({r.rating_count} {r.rating_count === 1 ? "reseña" : "reseñas"})
            </span>
          </p>
        ) : (
          <p className="tarjeta-estrellas">Todavía sin reseñas</p>
        )}

        <p className="tarjeta-linea">
          <span>
            <span aria-hidden="true">{icono}</span>
            <span>{r.cuisines?.length ? r.cuisines.join(" · ") : r.summary || "Restaurante"}</span>
          </span>
        </p>

        <p className="tarjeta-linea">
          <span>
            <span aria-hidden="true">◎</span>
            <span>{lugarDe(r) || "México"}</span>
          </span>
        </p>

        <div className="tarjeta-acciones">
          <Link className="btn" href={rutaMenu(r.slug)}>
            Ver menú
          </Link>
          <Link className="btn-linea" href={rutaFicha(r.slug)}>
            Ver detalles
          </Link>
        </div>
      </div>
    </article>
  );
}
