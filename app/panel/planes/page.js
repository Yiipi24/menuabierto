import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { PLANES, menusIncluidos, nombreDelPlan, ordenDePlan, planVigente } from "../../../lib/planes";
import {
  MONEDA,
  TOPE_OXXO_CENTAVOS,
  adelantoVigente,
  estadoLegible,
  medioLegible,
  pagoPorCobrar,
  precioDe,
} from "../../../lib/cobro";
import { cobroConfigurado } from "../../../lib/mercadopago";
import { confirmarPendientes, pagosVigentes } from "../../../lib/adelantos";
import { pesos } from "../../../lib/precios";
import { rutaFicha } from "../../../lib/slug";
import CabeceraPanel from "../cabecera";
import {
  IconoAbrir,
  IconoCarta,
  IconoCorona,
  IconoDiamante,
  IconoInfo,
  IconoPalomita,
  IconoTienda,
  IconoWhatsapp,
} from "../tablero-iconos";
import { planesParaElegir } from "../../../lib/opciones-de-pago";
import { cancelarPlan } from "./actions";
import ElegirPlan from "./elegir-plan";

export const metadata = { title: "Planes — Menú Abierto" };

const BUCKET_FOTOS = "restaurantes";

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

const ICONOS_PLAN = {
  basico: IconoTienda,
  plus: IconoCorona,
  premium: IconoDiamante,
  pedidos: IconoWhatsapp,
};

// Lo que más se compara entre planes es cuántos menús caben: en la lista de
// cada tarjeta, la cifra va en negritas.
function conCifras(texto) {
  return texto.split(/(\d+ menús)/).map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : parte));
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
    .select("id, name, slug, status, plan, premium_until")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  const ids = (restaurantes ?? []).map((r) => r.id);
  const [{ data: menus }, { data: suscripciones }, { data: fotos }] = ids.length
    ? await Promise.all([
        supabase.from("menus").select("id, restaurant_id").in("restaurant_id", ids),
        supabase
          .from("subscriptions")
          .select("restaurant_id, plan, status, next_payment_at")
          .in("restaurant_id", ids),
        supabase
          .from("restaurant_media")
          .select("restaurant_id, storage_path, category, position")
          .in("restaurant_id", ids)
          .order("position"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const suscripcionDe = new Map((suscripciones ?? []).map((s) => [s.restaurant_id, s]));

  // La miniatura de cada ficha es su fachada; si no tiene, la primera foto.
  // Es la misma regla que el selector del tablero.
  const portadaDe = new Map();
  for (const f of fotos ?? []) {
    const actual = portadaDe.get(f.restaurant_id);
    if (!actual || (f.category === "fachada" && actual.category !== "fachada")) portadaDe.set(f.restaurant_id, f);
  }

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

      <main className="wrap wrap-ancho panel-main planes-pagina">
        <header className="planes-encabezado">
          <div>
            <h1>Planes</h1>
            <p className="planes-subtitulo">
              Elige el plan ideal para tu restaurante. Puedes cambiar de plan cuando lo necesites.
            </p>
          </div>
          <div className="planes-por-restaurante">
            <span className="planes-por-restaurante-icono">
              <IconoTienda ancho={22} />
            </span>
            <p>
              <strong>Un plan por restaurante</strong>
              Cada restaurante puede tener un plan diferente.
            </p>
          </div>
        </header>

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

        <section className="planes-grid" aria-label="Comparación de planes">
          {PLANES.map((p) => {
            const Icono = ICONOS_PLAN[p.slug] ?? IconoTienda;
            const centavos = precioDe(p.slug);
            return (
              <article
                className={p.destacado ? "plan-tarjeta plan-tarjeta-recomendada" : "plan-tarjeta"}
                key={p.slug}
              >
                {p.destacado ? <span className="plan-recomendado">Recomendado</span> : null}
                <span className="plan-tarjeta-icono">
                  <Icono ancho={22} />
                </span>
                <h2>{p.nombre}</h2>
                <p className="plan-tarjeta-precio">
                  {centavos ? pesos(centavos, MONEDA) : p.precio}
                  <span>{centavos ? `${MONEDA} al mes` : p.detalle}</span>
                </p>
                <p className="plan-tarjeta-resumen">{p.resumen}</p>
                <ul>
                  {p.incluye.map((linea) => (
                    <li key={linea}>
                      <IconoPalomita ancho={16} />
                      <span>{conCifras(linea)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <section className="formas-de-pago" aria-labelledby="titulo-formas-de-pago">
          <div className="formas-de-pago-titulo">
            <span className="formas-de-pago-icono">
              <IconoInfo ancho={20} />
            </span>
            <h2 id="titulo-formas-de-pago">Formas de pago</h2>
          </div>
          <dl className="formas-de-pago-lista">
            <div>
              <dt>Cada mes</dt>
              <dd>
                Cobro automático con tarjeta de crédito o de débito, con Mercado Pago. Lo cancelas
                cuando quieras.
              </dd>
            </div>
            <div>
              <dt>Por adelantado</dt>
              <dd>
                De uno a doce meses en un solo pago: OXXO, SPEI, saldo de Mercado Pago o tarjeta. En
                OXXO, hasta {pesos(TOPE_OXXO_CENTAVOS, MONEDA)} por pago; lo que pase de eso, por SPEI,
                con saldo o con tarjeta.
              </dd>
            </div>
            <div>
              <dt>Al vencer o cancelar</dt>
              <dd>
                Lo pagado por adelantado no se renueva solo: al vencer, pagas otros meses o activas el
                cobro automático. Un plan que se cancela o deja de pagarse vuelve a Básico al vencer;
                tus menús de más siguen guardados, pero no se ven hasta que renueves o borres los que
                sobren.
              </dd>
            </div>
            <div>
              <dt>Bueno saber</dt>
              <dd>
                En Pedidos, los mensajes de WhatsApp los cobra Meta aparte, a la tarjeta de tu cuenta de
                WhatsApp. Si estás en la lista de espera, conservas el precio de lanzamiento el primer
                año. La factura fiscal (CFDI) todavía no se emite desde aquí.
              </dd>
            </div>
          </dl>
        </section>

        {restaurantes?.length ? (
          <section className="planes-restaurantes" aria-labelledby="titulo-tus-restaurantes">
            <h2 id="titulo-tus-restaurantes">Tus restaurantes</h2>
            <p className="planes-subtitulo">Elige el plan y la forma de pago para cada restaurante.</p>

            <ul className="lista-planes-restaurante">
              {restaurantes.map((r) => {
                const usados = (menus ?? []).filter((m) => m.restaurant_id === r.id).length;
                const vigente = planVigente(r);
                const suscripcion = suscripcionDe.get(r.id) ?? null;
                const viva = suscripcion && suscripcion.status !== "cancelled";
                const estado = suscripcion ? estadoLegible(suscripcion.status) : null;
                const pagosDeEsta = pagos.filter((p) => p.restaurant_id === r.id);
                const adelanto = adelantoVigente(pagosDeEsta);
                const porCobrar = pagosDeEsta.find((p) => pagoPorCobrar(p)) ?? null;
                const portada = portadaDe.get(r.id);
                const foto = portada
                  ? supabase.storage.from(BUCKET_FOTOS).getPublicUrl(portada.storage_path).data.publicUrl
                  : null;
                // Con meses pagados por adelantado, al subir de plan lo que
                // queda se convierte en días del nuevo. Lo que viene de la
                // suscripción no: no hay pago por adelantado del que salga el
                // valor. El selector lo dice solo si se elige un plan más alto.
                const notaSubir =
                  adelanto && !porCobrar
                    ? `Lo que te queda de lo que pagaste por ${nombreDelPlan(r)} se convierte en días del nuevo plan.`
                    : null;

                return (
                  <li className="restaurante-plan" key={r.id}>
                    <div className="restaurante-plan-cabeza">
                      <div className="restaurante-plan-foto" aria-hidden="true">
                        {foto ? (
                          <img src={foto} alt="" loading="lazy" width={128} height={88} />
                        ) : (
                          <IconoTienda ancho={28} />
                        )}
                      </div>
                      <div className="restaurante-plan-nombre">
                        <h3>{r.name}</h3>
                        {r.status === "publicado" && r.slug ? (
                          <Link href={rutaFicha(r.slug)} target="_blank" rel="noopener" className="restaurante-plan-enlace">
                            Ver mi perfil público
                            <IconoAbrir ancho={14} />
                          </Link>
                        ) : null}
                        {adelanto ? (
                          <small className="restaurante-plan-detalle">
                            Pagado por adelantado
                            {r.premium_until ? ` · vigente hasta el ${fechaCorta(r.premium_until)}` : ""}
                          </small>
                        ) : suscripcion ? (
                          <small className="restaurante-plan-detalle">
                            {estado.nombre}
                            {vigente !== "basico" && r.premium_until
                              ? ` · ${suscripcion.status === "cancelled" ? "hasta" : "vigente hasta"} el ${fechaCorta(r.premium_until)}`
                              : ""}
                          </small>
                        ) : null}
                        {porCobrar ? (
                          <small className="restaurante-plan-detalle">
                            Pago pendiente{medioLegible(porCobrar.method) ? ` ${medioLegible(porCobrar.method)}` : ""}
                            {porCobrar.expires_at ? ` · tienes hasta el ${fechaCorta(porCobrar.expires_at)}` : ""}
                          </small>
                        ) : null}
                      </div>
                      <div className="restaurante-plan-datos">
                        <span className="chip-plan">
                          Plan actual: <strong>{nombreDelPlan(r)}</strong>
                        </span>
                        <span className="chip-plan">
                          {usados} de {menusIncluidos(r)} menús
                        </span>
                        <Link className="chip-plan chip-enlace" href={`/panel/${r.id}/menus`}>
                          <IconoCarta ancho={16} />
                          Menús
                        </Link>
                      </div>
                    </div>

                    <ElegirPlan
                      restaurante={{
                        id: r.id,
                        nombre: r.name,
                        moneda: MONEDA,
                        topeOxxo: pesos(TOPE_OXXO_CENTAVOS, MONEDA),
                      }}
                      planes={planesParaElegir({ vigente, suscripcion, viva, adelanto, porCobrar })}
                      cobroActivo={cobroActivo}
                      notaSubir={notaSubir}
                      ordenVigente={ordenDePlan(vigente)}
                    />

                    {viva ? (
                      <form action={cancelarPlan} className="restaurante-plan-cancelar">
                        <input type="hidden" name="restaurante" value={r.id} />
                        <span>¿Ya no quieres el cobro automático?</span>
                        <button className="btn-texto" type="submit">
                          Cancelar suscripción
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
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
