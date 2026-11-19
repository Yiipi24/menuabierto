import Link from "next/link";
import Nav from "../nav";
import { RESPONSABLE, fechaLegible, quienResponde } from "../../lib/legal";
import { PLANES } from "../../lib/planes";
import { MESES_POR_ADELANTADO, precioDe } from "../../lib/cobro";
import { pesos } from "../../lib/precios";

export const metadata = {
  title: "Términos y condiciones — Menú Abierto",
  description:
    "Las reglas para usar Menú Abierto como comensal o como restaurante: cuentas, reseñas, fichas, planes, pagos y cancelación.",
  alternates: { canonical: "/terminos" },
};

function Pendiente({ children }) {
  return <mark className="legal-pendiente">[Pendiente: {children}]</mark>;
}

// Los precios salen de lib/cobro, que es lo que cobra la pasarela: así el
// texto no puede decir un precio y el checkout otro.
function planesDePaga() {
  return PLANES.filter((p) => precioDe(p.slug) != null).map((p) => ({
    nombre: p.nombre,
    precio: pesos(precioDe(p.slug)),
  }));
}

export default function Terminos() {
  const correo = RESPONSABLE.correo;
  const planes = planesDePaga();
  const meses = MESES_POR_ADELANTADO.join(", ").replace(/, (\d+)$/, " o $1");

  return (
    <>
      <Nav />
      <main className="wrap panel-main panel-angosto legal">
        <h1>Términos y condiciones</h1>
        <p className="legal-fecha">Última actualización: {fechaLegible()}</p>

        <p className="panel-lead">
          Estos términos son las reglas para usar Menú Abierto, como comensal o como
          restaurante. Al usar el sitio o crear una cuenta los aceptas. Cómo tratamos tus
          datos está en el <Link href="/privacidad">Aviso de privacidad</Link>.
        </p>

        <h2 id="quienes">1. Quiénes somos</h2>
        <p>
          Menú Abierto lo opera{" "}
          {RESPONSABLE.nombre ? quienResponde() : <Pendiente>nombre o razón social</Pendiente>}, con
          domicilio en{" "}
          {RESPONSABLE.domicilio ? RESPONSABLE.domicilio : <Pendiente>domicilio</Pendiente>}.
          Nos encuentras en <a href={`mailto:${correo}`}>{correo}</a>.
        </p>

        <h2 id="servicio">2. Qué es Menú Abierto</h2>
        <p>
          Un directorio de restaurantes con sus cartas, precios y reseñas, y una herramienta
          para que cada restaurante publique su carta digital con QR, conteste reseñas, mida
          sus visitas y, en algunos planes, reciba pedidos por WhatsApp.
        </p>
        <p>
          Menú Abierto no vende comida ni la entrega. Lo que pides, lo vende y lo entrega el
          restaurante, y el pago de la comida se arregla con él.
        </p>

        <h2 id="cuenta">3. Tu cuenta</h2>
        <ul>
          <li>Usa datos verdaderos y tu nombre real o el de tu negocio.</li>
          <li>
            Debes ser mayor de edad, o usar el sitio con permiso de quien ejerza tu patria
            potestad o tutela.
          </li>
          <li>
            Cuida tu contraseña. Lo que se haga con tu cuenta es tu responsabilidad mientras no
            nos avises que alguien más entró.
          </li>
          <li>
            Puedes pedir que borremos tu cuenta escribiendo a{" "}
            <a href={`mailto:${correo}`}>{correo}</a>.
          </li>
        </ul>

        <h2 id="resenas">4. Reseñas y lo que publicas</h2>
        <ul>
          <li>
            Reseña lugares donde estuviste o a los que pediste. Una reseña con la marca
            “Verificada” viene de alguien que escaneó el QR del local o recibió su pedido.
          </li>
          <li>
            No publiques reseñas falsas, ofensivas, discriminatorias o con publicidad, ni datos
            personales de otras personas.
          </li>
          <li>
            Cualquier persona con cuenta puede reportar una reseña. Revisamos los reportes a
            mano y podemos retirar lo que no cumpla estas reglas.
          </li>
          <li>
            Lo que publicas sigue siendo tuyo. Nos das permiso, gratuito y mientras esté
            publicado, para mostrarlo en el sitio junto a tu nombre y adaptarlo al formato de
            cada página.
          </li>
          <li>
            El restaurante puede contestar tu reseña en público. Su respuesta es suya, no
            nuestra.
          </li>
        </ul>

        <h2 id="restaurantes">5. Si tienes un restaurante</h2>
        <ul>
          <li>
            Algunas fichas se crearon con datos públicos del Directorio Estadístico Nacional de
            Unidades Económicas (DENUE) del INEGI. Si una es tuya, puedes reclamarla. Si
            prefieres que no aparezca, escríbenos.
          </li>
          <li>
            Solo puede reclamar una ficha su dueño o alguien a quien el dueño autorizó. Podemos
            pedir pruebas y rechazar o retirar un reclamo que no las tenga.
          </li>
          <li>
            Tú eres responsable de lo que publicas en tu ficha: la carta, los precios, la
            disponibilidad, el horario, los cupones y sus condiciones, y las fotos, que deben
            ser tuyas o tener permiso para usarlas.
          </li>
          <li>
            Los precios de tu carta deben ser el total que paga el cliente, con los impuestos
            incluidos, como pide la Ley Federal de Protección al Consumidor.
          </li>
          <li>
            Si recibes pedidos por WhatsApp, eres el responsable de los datos de tus clientes y
            debes darles tu propio aviso de privacidad. Nosotros operamos el asistente por tu
            cuenta y contesta con los datos de tu ficha, así que mantenla al día.
          </li>
        </ul>

        <h2 id="planes">6. Planes y pagos</h2>
        <p>
          El plan Básico es gratuito. Los planes de paga cuestan, al mes,{" "}
          <strong>más IVA</strong>:
        </p>
        <ul>
          {planes.map((p) => (
            <li key={p.nombre}>
              {p.nombre}: {p.precio} MXN
            </li>
          ))}
        </ul>
        <ul>
          <li>
            Los cobros los procesa Mercado Pago. Con tarjeta, el plan se cobra cada mes hasta
            que lo canceles. Si cancelas, conservas lo que ya pagaste hasta el final de ese
            periodo y no se te vuelve a cobrar.
          </li>
          <li>
            También puedes pagar por adelantado {meses} meses en OXXO, por SPEI o con saldo de
            Mercado Pago. Ese pago no se renueva solo: al vencer, la ficha vuelve al plan
            Básico.
          </li>
          <li>
            Si subes a un plan más alto, lo que te quedaba pagado por adelantado del plan
            anterior se convierte en días del plan nuevo. No se puede bajar de plan a mitad de
            un periodo.
          </li>
          <li>
            Al volver a un plan con menos funciones no se borra nada: lo que no cabe en el plan
            se queda guardado y oculto hasta que vuelvas a subir.
          </li>
          <li>
            Por ahora no emitimos factura (CFDI). Si necesitas aclarar un cobro o pedir una
            devolución, escríbenos a <a href={`mailto:${correo}`}>{correo}</a> y lo revisamos
            caso por caso.
          </li>
          <li>
            Podemos cambiar los precios. Un cambio no afecta un periodo que ya pagaste, y te lo
            avisaremos antes de que aplique.
          </li>
        </ul>

        <h2 id="uso">7. Lo que no se vale</h2>
        <ul>
          <li>Hacerte pasar por otra persona o por un negocio que no es tuyo.</li>
          <li>Publicar contenido ilegal, engañoso o que infrinja derechos de otros.</li>
          <li>
            Copiar el sitio de forma automatizada, saturarlo, o intentar entrar a cuentas o
            datos que no son tuyos.
          </li>
          <li>Usar el asistente de WhatsApp para mandar mensajes que el cliente no pidió.</li>
        </ul>

        <h2 id="responsabilidad">8. Hasta dónde respondemos</h2>
        <p>
          Hacemos lo posible por que el sitio funcione siempre y la información sea correcta,
          pero no podemos garantizarlo. Los precios y datos de cada ficha los captura el
          restaurante y pueden tardar en actualizarse. No respondemos por la comida, el
          servicio ni las entregas de los restaurantes, ni por lo que publican otros usuarios.
        </p>

        <h2 id="baja">9. Suspensión y baja</h2>
        <p>
          Podemos suspender o dar de baja una cuenta, una ficha o un contenido que no cumpla
          estos términos. Si es tu caso, te diremos por qué cuando sea posible. Tú puedes dejar
          de usar el sitio cuando quieras.
        </p>

        <h2 id="cambios">10. Cambios a estos términos</h2>
        <p>
          Si estos términos cambian, publicaremos la versión nueva aquí con su fecha. Si el
          cambio es importante, también lo avisaremos en el sitio o por correo antes de que
          aplique.
        </p>

        <h2 id="ley">11. Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes federales de México. Para cualquier
          controversia nos sometemos a los tribunales competentes de{" "}
          {RESPONSABLE.ciudadTribunales ? RESPONSABLE.ciudadTribunales : <Pendiente>ciudad</Pendiente>}.
          Si eres consumidor, también puedes acudir a la Procuraduría Federal del Consumidor
          (PROFECO).
        </p>

        <p className="ayuda legal-pie">
          ¿Dudas? Escríbenos a <a href={`mailto:${correo}`}>{correo}</a>.
        </p>
      </main>
    </>
  );
}
