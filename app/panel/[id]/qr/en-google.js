import CopiarEnlace from "./copiar";
import { marcarCartaEnGoogle } from "../../actions";

// "Tu carta en Google Maps", en la pantalla del QR (#100): el enlace de la
// carta para copiar, los tres pasos del Perfil de Negocio y el botón para
// marcarlo hecho, que anota `google_enlazado` en el embudo.
export default function CartaEnGoogle({ id, urlCarta, publicado, hecho }) {
  return (
    <section className="panel-tarjeta qr-bloque" id="google">
      <h2>Tu carta en Google Maps</h2>
      <p className="qr-parrafo">
        Casi todos buscan dónde comer en Google Maps, y ahí tu menú suele
        ser una foto vieja que subió un cliente. Pega este enlace en tu
        Perfil de Negocio y el botón de menú lleva a tu carta de aquí, con
        tus precios de hoy.
      </p>
      <CopiarEnlace url={urlCarta} idNodo="enlace-carta" />
      <ol className="qr-pasos">
        <li>
          En una computadora, abre tu Perfil de Negocio: busca en Google el
          nombre de tu restaurante con la cuenta que lo administra, o entra a{" "}
          <a href="https://business.google.com/" target="_blank" rel="noopener noreferrer">
            business.google.com
          </a>
          .
        </li>
        <li>Toca «Editar perfil» y ve a la sección de contacto.</li>
        <li>En el enlace del menú, pega el de tu carta y guarda.</li>
      </ol>
      <p className="qr-parrafo qr-nota">
        Tu perfil tiene que estar verificado, y Google revisa el cambio
        antes de enseñarlo.
        {publicado ? null : " Publica tu ficha antes: mientras esté en borrador, el enlace da 404."}
      </p>
      {hecho ? (
        <p className="qr-parrafo qr-hecho">Listo: marcaste que ya está en tu perfil de Google.</p>
      ) : (
        <form action={marcarCartaEnGoogle}>
          <input type="hidden" name="id" value={id} />
          <button className="btn btn-sm" type="submit">
            Ya la puse en Google
          </button>
        </form>
      )}
    </section>
  );
}
