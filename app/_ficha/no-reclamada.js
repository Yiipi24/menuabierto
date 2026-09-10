import Link from "next/link";
import { FUENTE_DENUE } from "../../lib/denue";

// El aviso de una ficha que sembramos nosotros y el negocio no ha confirmado.
//
// Dice tres cosas, en este orden: que la información no la publicó el
// restaurante, de dónde salió, y qué hacer si el restaurante es tuyo. No se
// disculpa ni se esconde: un directorio que arranca tiene más fichas sembradas
// que reclamadas, y quien lee merece saber cuál está mirando.
export default function NoReclamada({ restauranteId, nombre, fuente }) {
  const origen =
    fuente === "denue" ? (
      <>
        Los datos vienen del{" "}
        <a href={FUENTE_DENUE.url} target="_blank" rel="noopener noreferrer">
          {FUENTE_DENUE.nombre}
        </a>
        , el directorio público de negocios de México.
      </>
    ) : (
      <>Los datos los cargó el equipo de Menú Abierto.</>
    );

  return (
    <div className="wrap wrap-ficha">
      <aside className="ficha-noreclamada" aria-label="Ficha sin verificar">
        <div className="ficha-noreclamada-texto">
          <strong>Esta ficha todavía no la administra el restaurante.</strong>
          <p>
            {origen} Puede haber cambiado de teléfono, de horario o de dirección, y por eso no
            enseña menú ni precios: nada aquí lo publicó {nombre}.
          </p>
        </div>
        <Link className="btn-linea btn-sm" href={`/reclamar?ficha=${encodeURIComponent(restauranteId)}`}>
          ¿Es tu restaurante? Reclámalo
        </Link>
      </aside>
    </div>
  );
}
