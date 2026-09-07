import Link from "next/link";
import { rutaFicha } from "../../lib/slug";
import { cambiarEstado } from "./actions";
import BorrarRestaurante from "./borrar";
import { Avatar, Estado, Lugar } from "./tablero-piezas";
import {
  IconoLapiz,
  IconoCarta,
  IconoQr,
  IconoEstrella,
  IconoOjo,
  IconoOjoTachado,
  IconoAbrir,
  IconoBote,
} from "./tablero-iconos";

// Cada restaurante con sus acciones al lado. Antes las acciones vivían en una
// tarjeta suelta al final del tablero ("Gestiona tu restaurante") y siempre
// eran las del restaurante seleccionado: con dos o tres locales había que
// mirar arriba para saber a cuál le estabas dando a "Borrar". Ahora la fila es
// el restaurante y lo que hay en ella le pertenece.
export function FilaRestaurante({ restaurante }) {
  const publicado = restaurante.status === "publicado";

  return (
    <article className="rest-fila">
      <div className="rest-identidad">
        <Avatar restaurante={restaurante} />
        <div className="rest-datos">
          <h2>{restaurante.name}</h2>
          <Lugar restaurante={restaurante} />
        </div>
        <Estado status={restaurante.status} />
      </div>

      <div className="rest-acciones">
        <Link className="btn-linea" href={`/panel/${restaurante.id}`}>
          <IconoLapiz ancho={17} />
          Seguir editando
        </Link>
        <Link className="btn-linea" href={`/panel/${restaurante.id}/menus`}>
          <IconoCarta ancho={17} />
          Menús
        </Link>
        <Link className="btn-linea" href={`/panel/${restaurante.id}/qr`}>
          <IconoQr ancho={17} />
          Su QR
        </Link>
        <Link className="btn-linea" href={`${rutaFicha(restaurante.slug)}#resenas`}>
          <IconoEstrella ancho={17} />
          Reseñas
        </Link>
        {/* "Ver" abre la ficha pública, que es otro sitio y no otra pantalla
            del panel: va en pestaña nueva para no perder el tablero, y es la
            única acción en naranja porque es la que más se usa. */}
        <a
          className="btn rest-ver"
          href={rutaFicha(restaurante.slug)}
          target="_blank"
          rel="noreferrer"
        >
          <IconoAbrir ancho={17} />
          Ver
        </a>
        <form action={cambiarEstado}>
          <input type="hidden" name="id" value={restaurante.id} />
          <input type="hidden" name="status" value={publicado ? "oculto" : "publicado"} />
          <button className="btn-linea" type="submit">
            {publicado ? <IconoOjoTachado ancho={17} /> : <IconoOjo ancho={17} />}
            {publicado ? "Ocultar" : "Publicar"}
          </button>
        </form>
        {/* Borrar es irreversible: se queda al final, sin caja de color y con
            la confirmación que pide el nombre en la pregunta. */}
        <BorrarRestaurante
          id={restaurante.id}
          nombre={restaurante.name}
          clase="btn-linea btn-peligro"
        >
          <IconoBote ancho={17} />
        </BorrarRestaurante>
      </div>
    </article>
  );
}

export default function ListaDeRestaurantes({ restaurantes }) {
  return (
    <section className="rest-lista">
      {restaurantes.map((r) => (
        <FilaRestaurante key={r.id} restaurante={r} />
      ))}
    </section>
  );
}
