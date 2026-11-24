import Link from "next/link";
import { empezarCartaConFoto } from "./menus/actions";
import { IconoPalomita } from "../tablero-iconos";
import { CORREO_DE_SOPORTE, enlaceDeCorreo } from "../../../lib/soporte";

// La lista "Para publicar tu ficha" (#88), arriba del editor. Cada paso se
// marca solo con lo que la ficha ya tiene (lib/alta.js) y lleva a donde se
// completa. Desaparece cuando todo está listo: una lista de pendientes sin
// pendientes es ruido.
export default function AltaGuiada({ id, lista, avance, publicado, tieneMenus }) {
  if (avance.completa) return null;

  const destino = {
    direccion: { href: "#direccion", texto: "Escribir la dirección" },
    horario: { href: "#horario", texto: "Poner el horario" },
    foto: { href: "#fotos", texto: "Subir una foto" },
    carta: { href: `/panel/${id}/menus`, texto: "Ir a los menús" },
    qr: { href: `/panel/${id}/qr`, texto: "Ver y descargar el QR" },
    publicar: { href: "#publicar", texto: "Publicar arriba" },
    google: { href: `/panel/${id}/qr#google`, texto: "Ver cómo hacerlo" },
  };

  return (
    <section className="alta-guiada" aria-labelledby="alta-guiada-titulo">
      <div className="alta-guiada-cabeza">
        <h2 id="alta-guiada-titulo">
          {publicado ? "Para que tu ficha se vea completa" : "Para publicar tu ficha"}
        </h2>
        <span className="alta-guiada-avance">
          {avance.listos} de {avance.total}
        </span>
      </div>
      <div
        className="alta-guiada-barra"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={avance.total}
        aria-valuenow={avance.listos}
        aria-label="Avance del alta"
      >
        <span style={{ width: `${(avance.listos / avance.total) * 100}%` }} />
      </div>

      <ol className="alta-guiada-lista">
        {lista.map((paso, i) => (
          <li key={paso.clave} className={paso.listo ? "alta-paso es-listo" : "alta-paso"}>
            <span className="alta-paso-marca" aria-hidden="true">
              {paso.listo ? <IconoPalomita ancho={14} /> : i + 1}
            </span>
            <div className="alta-paso-texto">
              <strong>
                {paso.titulo}
                {paso.listo ? <span className="sr-only"> (listo)</span> : null}
              </strong>
              {paso.listo ? null : <p>{paso.ayuda}</p>}
              {paso.listo ? null : paso.clave === "carta" && !tieneMenus ? (
                // El primer menú: la foto primero, porque capturar sesenta
                // platillos a mano es lo que más abandona el alta.
                <div className="alta-paso-acciones">
                  <form action={empezarCartaConFoto}>
                    <input type="hidden" name="id" value={id} />
                    <button className="btn btn-sm" type="submit">
                      Cargar tu carta desde una foto
                    </button>
                  </form>
                  <Link className="btn-texto" href={`/panel/${id}/menus`}>
                    Capturarla a mano
                  </Link>
                </div>
              ) : paso.listo ? null : (
                <Link className="alta-paso-enlace" href={destino[paso.clave].href}>
                  {destino[paso.clave].texto}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="alta-guiada-ayuda">
        ¿Te atoraste? <Link href="/ayuda#duenos">Lee las preguntas frecuentes</Link> o{" "}
        <a href={enlaceDeCorreo(CORREO_DE_SOPORTE, "Ayuda con el alta")}>
          escríbenos
        </a>
        .
      </p>
    </section>
  );
}
