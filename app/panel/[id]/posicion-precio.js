import Link from "next/link";
import { pesos } from "../../../lib/precios";
import { leerPosicion } from "../../../lib/inteligencia-precios";
import { planVigente } from "../../../lib/planes";

// La tarjeta de posición de precio del tablero, dentro de Premium: cómo está
// la mediana de la carta contra la de la zona y la de la cocina, y el aviso
// cuando queda muy por encima o por debajo. Todo agregado: la función de la
// base nunca devuelve el precio de un competidor con nombre, y calla cuando
// hay menos de tres detrás.
export default async function PosicionDePrecio({ supabase, restaurante }) {
  const premium = planVigente(restaurante) === "premium";

  let posicion = null;
  if (premium) {
    const { data, error } = await supabase.rpc("posicion_de_precio", { rid: restaurante.id });
    if (error) console.error("posicion de precio", error.message);
    posicion = leerPosicion(data);
  }

  return (
    <section className={posicion?.aviso ? "bloque-qr bloque-precio es-aviso" : "bloque-qr bloque-precio"}>
      <div className="bloque-qr-texto">
        <h2 className="sub">Tu posición de precio</h2>
        {!premium ? (
          <p className="ayuda">
            Con Premium ves cómo se compara tu carta con la de tu colonia y la de tu tipo de cocina, y te
            avisamos cuando te quedas muy por encima o por debajo. Siempre en cifras agregadas: nunca el precio
            de un competidor con nombre.
          </p>
        ) : !posicion.lista ? (
          <p className="ayuda">{posicion.texto}</p>
        ) : (
          <>
            <p className="ayuda">
              La mediana de tus {posicion.misPlatillos} platillos con precio es <b>{pesos(posicion.miMediana)}</b>.
            </p>
            <ul className="bloque-precio-lista">
              <li className={posicion.zona.aviso ? "es-aviso" : ""}>{posicion.zona.texto}</li>
              <li className={posicion.cocina.aviso ? "es-aviso" : ""}>{posicion.cocina.texto}</li>
            </ul>
            {posicion.aviso ? (
              <p className="bloque-precio-aviso" role="status">
                Aviso: estás a más de un cuarto de distancia de tu zona o de tu cocina. Por debajo, dejas dinero en
                la mesa; por encima, mesas. Revisa tu carta.
              </p>
            ) : null}
            <p className="ayuda bloque-precio-nota">
              Medianas de restaurantes con carta publicada; solo se muestran con al menos {posicion.minimo} detrás.
            </p>
          </>
        )}
      </div>
      {!premium ? (
        <Link className="btn" href="/panel/planes">
          Ver Premium
        </Link>
      ) : (
        <Link className="btn-linea" href={`/precios?lugar=${encodeURIComponent(restaurante.neighborhood || restaurante.city || "")}`}>
          Ver los precios de tu zona
        </Link>
      )}
    </section>
  );
}
