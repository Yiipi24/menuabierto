import Link from "next/link";
import Nav from "../nav";
import { RESPONSABLE, fechaLegible, quienResponde } from "../../lib/legal";
import { DIAS_COOKIE } from "../../lib/eventos";

export const metadata = {
  title: "Aviso de privacidad — Menú Abierto",
  description:
    "Qué datos personales trata Menú Abierto, para qué, con quién los comparte y cómo ejercer tus derechos ARCO.",
  alternates: { canonical: "/privacidad" },
};

// El aviso de privacidad integral (LFPDPPP). Cada dato que nombra sale de lo
// que el sitio guarda de verdad: si se agrega una tabla o un formulario que
// recabe algo nuevo, este texto se actualiza en el mismo cambio, junto con
// ACTUALIZADO en lib/legal.js.
function Pendiente({ children }) {
  return <mark className="legal-pendiente">[Pendiente: {children}]</mark>;
}

export default function Privacidad() {
  const correo = RESPONSABLE.correo;

  return (
    <>
      <Nav />
      <main className="wrap panel-main panel-angosto legal">
        <h1>Aviso de privacidad</h1>
        <p className="legal-fecha">Última actualización: {fechaLegible()}</p>

        <p className="panel-lead">
          Este aviso explica qué datos personales tratamos cuando usas Menú Abierto, para qué
          los usamos, con quién los compartimos y cómo puedes ejercer tus derechos. Lo
          emitimos conforme a la Ley Federal de Protección de Datos Personales en Posesión
          de los Particulares (LFPDPPP).
        </p>

        <h2 id="responsable">1. Quién es el responsable</h2>
        <p>
          El responsable de tus datos personales es{" "}
          {RESPONSABLE.nombre ? <strong>{quienResponde()}</strong> : (
            <>
              <strong>{RESPONSABLE.marca}</strong>, operado por{" "}
              <Pendiente>nombre o razón social</Pendiente>
            </>
          )}
          , con domicilio en{" "}
          {RESPONSABLE.domicilio ? RESPONSABLE.domicilio : <Pendiente>domicilio</Pendiente>}.
        </p>
        <p>
          Para cualquier asunto de privacidad, escríbenos a{" "}
          <a href={`mailto:${correo}`}>{correo}</a>.
        </p>

        <h2 id="datos">2. Qué datos tratamos</h2>
        <p>Según cómo uses el sitio, tratamos estos datos:</p>
        <ul>
          <li>
            <strong>Si te anotas en la lista de espera:</strong> tu correo y si buscas dónde
            comer o tienes un restaurante.
          </li>
          <li>
            <strong>Si creas una cuenta:</strong> tu nombre, tu correo y tu contraseña (la
            guarda cifrada nuestro proveedor de autenticación; nosotros no podemos leerla).
            Si los agregas, también tu teléfono y tu foto de perfil.
          </li>
          <li>
            <strong>Lo que publicas o haces con tu cuenta:</strong> reseñas y su calificación,
            fotos, publicaciones e historias, comentarios, “me gusta”, los restaurantes que
            sigues o guardas como favoritos, los reportes que haces de una reseña, las
            insignias que ganas y los avisos que recibes.
          </li>
          <li>
            <strong>Si tienes un restaurante:</strong> los datos de tu negocio que capturas,
            lo que escribes para reclamar una ficha, y el historial de tus planes y pagos
            (plan, meses, monto, forma de pago, estado y, en las suscripciones, el correo con
            el que pagas en Mercado Pago). Los datos de tu tarjeta o de tu pago los recibe
            Mercado Pago, no nosotros.
          </li>
          <li id="pedidos-datos">
            <strong>Si pides por WhatsApp a un restaurante:</strong> tu número de WhatsApp, el
            nombre de tu perfil y el identificador que WhatsApp le asigna a tu chat, lo que
            pides, cómo lo quieres (aquí, para llevar o a domicilio), la dirección o ubicación
            que compartes para la entrega y las notas que agregues. Ver la sección{" "}
            <a href="#pedidos">Pedidos por WhatsApp</a>.
          </li>
          <li>
            <strong>Si visitas una ficha o una carta:</strong> un identificador aleatorio que
            guardamos en una cookie de tu navegador, la página desde la que llegaste (por
            ejemplo, el QR de la mesa) y la ciudad, región, país y ubicación aproximada que se
            deducen de tu conexión. No guardamos tu dirección IP. Si escaneas el QR de un
            restaurante, guardamos además un pase de visita.
          </li>
          <li>
            <strong>Si enciendes los avisos:</strong> la dirección de entrega que da tu
            navegador para las notificaciones, sus llaves de cifrado y el tipo de navegador.
          </li>
        </ul>
        <p>
          No te pedimos datos personales sensibles (salud, creencias, origen étnico,
          preferencia sexual u otros de ese tipo). Te pedimos no incluirlos en reseñas,
          comentarios ni notas de pedido.
        </p>

        <h2 id="finalidades">3. Para qué los usamos</h2>
        <p>
          <strong>Finalidades necesarias</strong>, sin las cuales no podemos darte el
          servicio:
        </p>
        <ul>
          <li>Crear y operar tu cuenta, y dejarte entrar a ella.</li>
          <li>Publicar tus reseñas, fotos, publicaciones y comentarios con tu nombre.</li>
          <li>Marcar como verificada la reseña de quien escaneó el QR o recibió su pedido.</li>
          <li>
            Darle al dueño de un restaurante su panel, verificar que una ficha es suya y
            cobrarle su plan.
          </li>
          <li>Mandarte los avisos que pediste, en el sitio y por notificación.</li>
          <li>Tomar tu pedido por WhatsApp y hacérselo llegar al restaurante.</li>
          <li>
            Darle a cada restaurante estadísticas de sus visitas, siempre agregadas (cuántas
            visitas, de qué ciudad, desde dónde llegaron), sin decirle quién eres.
          </li>
          <li>
            Mantener el sitio seguro: evitar abusos, atender reportes, investigar fallas y
            cumplir obligaciones legales.
          </li>
          <li>Si te anotaste en la lista de espera, avisarte cuando abramos.</li>
        </ul>
        <p>
          <strong>Finalidades voluntarias.</strong> Hoy no usamos tus datos para publicidad,
          mercadotecnia ni perfiles comerciales. Si algún día quisiéramos hacerlo, te
          pediríamos tu consentimiento antes, y podrías negarlo sin perder el servicio.
        </p>

        <h2 id="compartimos">4. Con quién los compartimos</h2>
        <p>
          No vendemos ni rentamos tus datos. Para operar el sitio usamos proveedores que los
          tratan por nuestra cuenta y solo para darnos su servicio:
        </p>
        <ul>
          <li>Supabase: base de datos, autenticación, archivos y los correos de tu cuenta.</li>
          <li>Vercel: el alojamiento del sitio y la analítica de páginas visitadas.</li>
          <li>Meta (WhatsApp Business): los mensajes del asistente de pedidos.</li>
          <li>Mercado Pago: los cobros de los planes para restaurantes.</li>
          <li>
            Anthropic: la lectura de la foto de una carta que sube un dueño, para convertirla
            en platillos.
          </li>
          <li>
            OpenStreetMap: los mapas y la ubicación de la dirección de un restaurante. Al
            enseñarte un mapa, tu navegador le pide las imágenes directamente.
          </li>
          <li>
            El servicio de notificaciones de tu navegador (Google, Apple o Mozilla): entrega los
            avisos que enciendes.
          </li>
        </ul>
        <p>
          Varios de estos proveedores guardan los datos fuera de México, principalmente en
          Estados Unidos.
        </p>
        <p>
          Lo que publicas a propósito (tu nombre junto a tus reseñas, fotos, publicaciones y
          comentarios) lo puede ver cualquier visitante. Solo entregamos datos a una
          autoridad cuando una ley o una orden lo exigen.
        </p>

        <h2 id="pedidos">5. Pedidos por WhatsApp</h2>
        <p>
          Cuando le pides a un restaurante por WhatsApp, el responsable de los datos de tu
          pedido es ese restaurante. Menú Abierto opera el asistente por su cuenta, como
          encargado: guarda tu pedido para que el restaurante lo vea en su panel, lo
          prepare y te lo entregue, y para mandarte después el enlace para reseñarlo. El
          restaurante debe darte su propio aviso de privacidad. Los mensajes viajan por
          WhatsApp, que tiene su propia política de privacidad.
        </p>

        <h2 id="cookies">6. Cookies y tecnologías parecidas</h2>
        <ul>
          <li>
            <strong>Cookies de sesión</strong>, para mantenerte dentro de tu cuenta. Sin ellas
            no puedes entrar.
          </li>
          <li>
            <strong>Cookie de visitante</strong> (<code>ma_visitante</code>): un identificador
            aleatorio que dura {DIAS_COOKIE} días. Sirve para contar visitas sin contarte dos
            veces y para ligar el pase de visita del QR a tu reseña.
          </li>
          <li>
            <strong>Almacenamiento de tu navegador</strong>, que no sale de tu equipo: las
            fichas que guardas sin cuenta y la página desde la que llegaste en esa pestaña.
          </li>
          <li>
            <strong>Analítica de Vercel</strong>: cuenta páginas vistas y desde dónde llegan,
            sin cookies.
          </li>
        </ul>
        <p>
          Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Si
          bloqueas las de sesión, no vas a poder entrar a tu cuenta.
        </p>

        <h2 id="conservacion">7. Cuánto tiempo los guardamos</h2>
        <ul>
          <li>Los datos de tu cuenta, mientras la tengas abierta.</li>
          <li>
            Tus reseñas, fotos y comentarios, hasta que los borres o pidas que borremos tu
            cuenta.
          </li>
          <li>
            Las historias se borran una semana después de caducar. Los pases de visita duran
            siete días y, si no se usaron para una reseña, se borran un mes después.
          </li>
          <li>
            Los pedidos, mientras el restaurante tenga su ficha, para su historial y sus
            estadísticas.
          </li>
          <li>Las suscripciones a avisos, hasta que los apagues.</li>
          <li>
            Los registros de pagos, el tiempo que exijan las leyes fiscales y mercantiles.
          </li>
          <li>Tu correo de la lista de espera, hasta que abramos y te avisemos.</li>
        </ul>

        <h2 id="arco">8. Tus derechos ARCO</h2>
        <p>
          Tienes derecho a <strong>acceder</strong> a tus datos, a <strong>rectificarlos</strong>{" "}
          si están mal, a <strong>cancelarlos</strong> cuando ya no sean necesarios y a{" "}
          <strong>oponerte</strong> a que los usemos para un fin concreto. También puedes{" "}
          <strong>revocar el consentimiento</strong> que nos diste.
        </p>
        <p>
          Para ejercerlos, escríbenos a <a href={`mailto:${correo}`}>{correo}</a> con el asunto
          “Derechos ARCO” e incluye:
        </p>
        <ul>
          <li>Tu nombre y el correo de tu cuenta, o el número de WhatsApp si es un pedido.</li>
          <li>Qué derecho quieres ejercer y sobre qué datos.</li>
          <li>
            Algo que demuestre que eres tú: escribir desde el correo de tu cuenta basta. Si
            actúa un representante, el documento que lo acredite.
          </li>
        </ul>
        <p>
          Te contestamos en un máximo de 20 días hábiles y, si procede, lo hacemos efectivo
          dentro de los 15 días hábiles siguientes. Es gratuito.
        </p>
        <p>
          Algunas cosas las puedes hacer tú mismo: editar o borrar tus reseñas, y apagar los
          avisos por tipo o en este dispositivo desde{" "}
          <Link href="/panel/cuenta#avisos">tu cuenta</Link>.
        </p>
        <p>
          Si crees que no atendimos bien tu solicitud, puedes acudir a la autoridad de
          protección de datos personales, hoy la Secretaría Anticorrupción y Buen Gobierno.
        </p>

        <h2 id="menores">9. Menores de edad</h2>
        <p>
          El sitio no está dirigido a menores de edad. Si eres menor, úsalo con el permiso de
          quien ejerza tu patria potestad o tutela.
        </p>

        <h2 id="cambios">10. Cambios a este aviso</h2>
        <p>
          Si este aviso cambia, publicaremos la versión nueva en esta misma página con su
          fecha. Si el cambio afecta lo que hacemos con tus datos, te avisaremos también en
          el sitio o por correo.
        </p>

        <p className="ayuda legal-pie">
          Ver también los <Link href="/terminos">Términos y condiciones</Link>.
        </p>
      </main>
    </>
  );
}
