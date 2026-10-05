import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { PLANES, menusIncluidos, nombreDelPlan, planVigente, subeOMantiene } from "../../../lib/planes";
import {
  MESES_POR_ADELANTADO,
  MONEDA,
  TOPE_OXXO_CENTAVOS,
  adelantoVigente,
  admiteOxxo,
  cobroAutomaticoActivo,
  estadoLegible,
  medioLegible,
  mesesLegibles,
  opcionDeAdelanto,
  pagoPorCobrar,
  precioDe,
  totalPorAdelantado,
} from "../../../lib/cobro";
import { cobroConfigurado } from "../../../lib/mercadopago";
import { confirmarPendientes, pagosVigentes } from "../../../lib/adelantos";
import { pesos } from "../../../lib/precios";
import CabeceraPanel from "../cabecera";
import { cancelarPlan, contratarPlan, pagarPorAdelantado } from "./actions";

export const metadata = { title: "Planes — Menú Abierto" };

// El catálogo de planes vive en lib/planes.js: la sección de menús necesita
// los mismos números para decir "3 de 5", y dos listas separadas se separan
// más. Los precios salen de lib/cobro.js, que es lo que se le manda a la
// pasarela: la página no puede prometer un precio distinto del que se cobra.

const AVISOS = {
  activo: { clase: "ok", texto: "Listo: tu plan ya está activo y el cupo de menús subió." },
  pendiente: {
    clase: "ok",
    texto: "Recibimos tu suscripción. El plan sube en cuanto la pasarela confirme el pago.",
  },
  cancelada: {
    clase: "ok",
    texto: "Suscripción cancelada. Tu plan sigue hasta el fin del periodo que ya pagaste.",
  },
  ya: { clase: "ok", texto: "Esa ficha ya tiene ese plan." },
  "adelanto-activo": { clase: "ok", texto: "Listo: recibimos tu pago y tu plan ya está activo." },
  "adelanto-pendiente": {
    clase: "ok",
    texto:
      "Tu pago quedó pendiente. Si elegiste OXXO o SPEI, el plan sube solo en cuanto Mercado Pago confirme que pagaste.",
  },
  "adelanto-rechazado": {
    clase: "err",
    texto: "El pago no pasó. Puedes intentarlo otra vez, con el mismo medio o con otro.",
  },
};

const ERRORES = {
  plan: "Ese plan no existe.",
  ficha: "Ese restaurante no es tuyo.",
  cobro: "El cobro todavía no está habilitado. Escríbenos y te avisamos cuando lo esté.",
  pasarela: "La pasarela de pago no respondió. Inténtalo otra vez en un momento.",
  adelanto:
    "Ya pagaste meses por adelantado. El cobro automático se puede activar cuando venzan.",
  "por-cobrar":
    "Tienes un pago en OXXO o SPEI por hacer. Págalo, o espera a que venza, antes de activar el cobro automático.",
  suscripcion:
    "Tienes el cobro automático activo. Para pagar por adelantado, cancélalo primero: lo que ya pagaste se respeta.",
  cambio:
    "Pagando por adelantado puedes quedarte en tu plan o subir; para bajar, espera a que venza el que tienes.",
  "otro-por-cobrar":
    "Tienes un pago en OXXO o SPEI por hacer de otro plan. Págalo, o espera a que venza, antes de pagar este.",
};

// Las opciones del pago por adelantado de una ficha: plan y meses juntos, con
// su total, para que el <select> diga cuánto es sin JavaScript. Con un plan
// vigente se ofrece ese y los de arriba; con una ficha de OXXO por pagar, solo
// el de la ficha. Lo que pasa del tope de OXXO lo dice ahí mismo.
function opcionesDeAdelanto(vigente, soloPlan) {
  return PLANES.filter((p) => (soloPlan ? p.slug === soloPlan : subeOMantiene(vigente, p.slug))).flatMap((p) =>
    MESES_POR_ADELANTADO.map((m) => {
      const total = totalPorAdelantado(p.slug, m);
      return {
        valor: opcionDeAdelanto(p.slug, m),
        texto: `${p.nombre} · ${mesesLegibles(m)} · ${pesos(total, MONEDA)}${admiteOxxo(total) ? "" : " · sin OXXO"}`,
      };
    }),
  );
}

function precioLegible(slug) {
  const centavos = precioDe(slug);
  return centavos ? `${pesos(centavos, MONEDA)} al mes` : null;
}

function fechaCorta(valor) {
  if (!valor) return null;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(valor),
  );
}

export default async function Planes({ searchParams }) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const params = await searchParams;
  const aviso = AVISOS[params?.aviso] ?? null;
  const error = ERRORES[params?.error] ?? null;
  const cobroActivo = cobroConfigurado();

  // Antes de leer los planes: si un pago en OXXO o SPEI se aprobó y su aviso
  // no llegó, aquí sube el plan y la página ya lo enseña.
  if (cobroActivo) {
    try {
      await confirmarPendientes(supabase);
    } catch (error) {
      console.error("cobro: no se pudieron revisar los pagos pendientes", error?.message);
    }
  }

  const { data: restaurantes } = await supabase
    .from("restaurants")
    .select("id, name, plan, premium_until")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  const ids = (restaurantes ?? []).map((r) => r.id);
  const [{ data: menus }, { data: suscripciones }] = ids.length
    ? await Promise.all([
        supabase.from("menus").select("id, restaurant_id").in("restaurant_id", ids),
        supabase
          .from("subscriptions")
          .select("restaurant_id, plan, status, next_payment_at")
          .in("restaurant_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const suscripcionDe = new Map((suscripciones ?? []).map((s) => [s.restaurant_id, s]));

  // Si los pagos no se pueden leer, la página se enseña igual, sin ellos: el
  // candado de verdad está en las acciones, que sí fallan cerrado.
  let pagos = [];
  try {
    pagos = await pagosVigentes(supabase, ids);
  } catch (error) {
    console.error("cobro: no se pudieron leer los pagos por adelantado", error?.message);
  }

  return (
    <div className="panel-wrap">
      <CabeceraPanel correo={auth.user.email} usuarioId={auth.user.id} atras="/panel" />

      <main className="wrap panel-main">
        <h1>Planes</h1>
        <p className="panel-lead">
          Cuatro planes, sin letras chiquitas. Publicar tu restaurante con su
          menú no cuesta; los de paga son para cuando necesites más menús,
          quieras destacar o quieras recibir pedidos por WhatsApp. Se cobran por
          restaurante: cada mes con tarjeta, o por adelantado en OXXO o por
          SPEI. Y se cancelan cuando quieras.
        </p>

        {aviso ? (
          <p className={`form-msg ${aviso.clase}`} role="status">
            {aviso.texto}
          </p>
        ) : null}
        {error ? (
          <p className="form-msg err" role="alert">
            {error}
          </p>
        ) : null}

        <div className="plans">
          {PLANES.map((p) => {
            const precio = precioLegible(p.slug);
            return (
              <article
                className={p.destacado ? "plan plan-featured" : "plan"}
                key={p.slug}
              >
                {p.destacado ? <span className="plan-badge">{p.nombre}</span> : null}
                <h2>{p.nombre}</h2>
                <div className="plan-price">
                  {precio ? pesos(precioDe(p.slug), MONEDA) : p.precio}{" "}
                  <span>{precio ? `${MONEDA} al mes` : p.detalle}</span>
                </div>
                <p className="plan-menus">{p.menus} menús por restaurante</p>
                <ul>
                  {p.incluye.map((linea) => (
                    <li key={linea}>{linea}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <p className="plan-note">
          Hay dos formas de pagar, las dos con Mercado Pago: cada mes en
          automático, con tarjeta de crédito o de débito, o por adelantado —de
          uno a doce meses en un solo pago— en OXXO, por SPEI, con saldo de
          Mercado Pago o con tarjeta. Lo que pagas por adelantado no se renueva
          solo: al vencer, pagas otros meses o activas el cobro automático. En
          OXXO se paga hasta {pesos(TOPE_OXXO_CENTAVOS, MONEDA)} de una vez; lo
          que pasa de eso, por SPEI, con saldo o con tarjeta. En el plan
          Pedidos, los mensajes de WhatsApp los cobra Meta aparte, a la tarjeta
          que el restaurante registra en su cuenta de WhatsApp.
          Quien esté en la lista de espera conserva el precio
          de lanzamiento el primer año. Un plan de paga que se cancela o deja
          de pagarse vuelve a Básico al vencer: los menús de más siguen
          guardados, pero dejan de verse hasta que renueves o borres los que
          sobren. La factura fiscal (CFDI) todavía no se emite desde aquí.
        </p>

        {restaurantes?.length ? (
          <>
            <h2 className="sub">Tus restaurantes</h2>
            <ul className="lista-planes">
              {restaurantes.map((r) => {
                const usados = (menus ?? []).filter((m) => m.restaurant_id === r.id).length;
                const vigente = planVigente(r);
                const suscripcion = suscripcionDe.get(r.id) ?? null;
                const viva = suscripcion && suscripcion.status !== "cancelled";
                const estado = suscripcion ? estadoLegible(suscripcion.status) : null;
                const pagosDeEsta = pagos.filter((p) => p.restaurant_id === r.id);
                const adelanto = adelantoVigente(pagosDeEsta);
                const porCobrar = pagosDeEsta.find((p) => pagoPorCobrar(p)) ?? null;
                // Las dos formas de pagar no se juntan: con una corriendo, la
                // otra cobraría dos veces el mismo mes.
                const puedeSuscribirse = !adelanto && !porCobrar;
                const opciones = cobroAutomaticoActivo(suscripcion)
                  ? []
                  : opcionesDeAdelanto(vigente, porCobrar?.plan ?? null);
                // Si entre las opciones hay un plan más alto, se dice qué
                // pasa con lo que queda del actual antes de pagar.
                const puedeSubir =
                  vigente !== "basico" && opciones.some((o) => !o.valor.startsWith(`${vigente}:`));
                return (
                  <li className="fila-plan" key={r.id}>
                    <div className="fila-plan-nombre">
                      {r.name}
                      {adelanto ? (
                        <small className="fila-plan-detalle">
                          Pagado por adelantado
                          {r.premium_until ? ` · vigente hasta el ${fechaCorta(r.premium_until)}` : ""}
                        </small>
                      ) : suscripcion ? (
                        <small className="fila-plan-detalle">
                          {estado.nombre}
                          {vigente !== "basico" && r.premium_until
                            ? ` · ${suscripcion.status === "cancelled" ? "hasta" : "vigente hasta"} el ${fechaCorta(r.premium_until)}`
                            : ""}
                        </small>
                      ) : null}
                      {porCobrar ? (
                        <small className="fila-plan-detalle">
                          Pago pendiente{medioLegible(porCobrar.method) ? ` ${medioLegible(porCobrar.method)}` : ""}
                          {porCobrar.expires_at ? ` · tienes hasta el ${fechaCorta(porCobrar.expires_at)}` : ""}
                        </small>
                      ) : null}
                    </div>
                    <span className={vigente === "basico" ? "estado" : "estado estado-publicado"}>
                      {nombreDelPlan(r)}
                    </span>
                    <span className="cupo">
                      {usados} de {menusIncluidos(r)} menús
                    </span>
                    <Link className="btn-texto" href={`/panel/${r.id}/menus`}>
                      Menús
                    </Link>

                    <div className="fila-plan-acciones">
                      {!puedeSuscribirse ? null : PLANES.filter((p) => p.slug !== "basico" && p.slug !== (viva ? suscripcion.plan : vigente)).map(
                        (p) => (
                          <form action={contratarPlan} key={p.slug}>
                            <input type="hidden" name="restaurante" value={r.id} />
                            <input type="hidden" name="plan" value={p.slug} />
                            <button
                              className={p.destacado ? "btn btn-sm" : "btn-linea btn-sm"}
                              type="submit"
                              disabled={!cobroActivo}
                              title={cobroActivo ? undefined : "El cobro aún no está habilitado"}
                            >
                              {viva || vigente !== "basico" ? `Cambiar a ${p.nombre}` : `Contratar ${p.nombre}`}
                            </button>
                          </form>
                        ),
                      )}
                      {opciones.length ? (
                        <form action={pagarPorAdelantado} className="form-adelanto">
                          <input type="hidden" name="restaurante" value={r.id} />
                          <select name="opcion" aria-label={`Pagar por adelantado: ${r.name}`}>
                            {opciones.map((o) => (
                              <option key={o.valor} value={o.valor}>
                                {o.texto}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn-linea btn-sm"
                            type="submit"
                            disabled={!cobroActivo}
                            title={cobroActivo ? undefined : "El cobro aún no está habilitado"}
                          >
                            Pagar por adelantado
                          </button>
                        </form>
                      ) : null}
                      {opciones.length && puedeSubir ? (
                        <small className="fila-plan-detalle">
                          Si subes de plan, lo que te queda de {nombreDelPlan(r)} se convierte en días del
                          nuevo, a su precio.
                        </small>
                      ) : null}
                      {viva ? (
                        <form action={cancelarPlan}>
                          <input type="hidden" name="restaurante" value={r.id} />
                          <button className="btn-texto" type="submit">
                            Cancelar suscripción
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="vacio">
            <h2>Todavía no tienes ningún restaurante</h2>
            <p>
              Da de alta el primero para ver aquí en qué plan está y cuántos
              menús te quedan. Empezar es gratis.
            </p>
            <Link className="btn" href="/panel/nuevo">
              Agregar restaurante
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
