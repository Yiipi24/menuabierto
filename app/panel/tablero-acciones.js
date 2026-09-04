import Link from "next/link";
import { rutaFicha } from "../../lib/slug";
import { cambiarEstado } from "./actions";
import BorrarRestaurante from "./borrar";
import {
  IconoLapiz,
  IconoCarta,
  IconoEstrella,
  IconoOjo,
  IconoOjoTachado,
  IconoBote,
} from "./tablero-iconos";

// Las mismas acciones que había en la lista de restaurantes, con las mismas
// rutas y el mismo server action: aquí solo cambia dónde se ven.
export default function AccionesDelRestaurante({ restaurante }) {
  const publicado = restaurante.status === "publicado";

  return (
    <section className="panel-tarjeta gestion">
      <div className="gestion-texto">
        <h2>Gestiona tu restaurante</h2>
        <p>Actualiza tu información, menús y más.</p>
      </div>
      <div className="gestion-botones">
        <Link className="btn-linea" href={`/panel/${restaurante.id}`}>
          <IconoLapiz ancho={17} />
          Seguir editando
        </Link>
        <Link className="btn-linea" href={`/panel/${restaurante.id}/menus`}>
          <IconoCarta ancho={17} />
          Menús
        </Link>
        <Link className="btn-linea" href={`${rutaFicha(restaurante.slug)}#resenas`}>
          <IconoEstrella ancho={17} />
          Reseñas
        </Link>
        <form action={cambiarEstado}>
          <input type="hidden" name="id" value={restaurante.id} />
          <input type="hidden" name="status" value={publicado ? "oculto" : "publicado"} />
          <button className="btn-linea" type="submit">
            {publicado ? <IconoOjoTachado ancho={17} /> : <IconoOjo ancho={17} />}
            {publicado ? "Ocultar" : "Publicar"}
          </button>
        </form>
        <BorrarRestaurante
          id={restaurante.id}
          nombre={restaurante.name}
          clase="btn-linea btn-peligro"
        >
          <IconoBote ancho={17} />
        </BorrarRestaurante>
      </div>
    </section>
  );
}
