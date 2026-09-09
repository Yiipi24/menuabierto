import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { PLANES, menusIncluidos, nombreDelPlan, planVigente } from "../../../lib/planes";
import { MONEDA, estadoLegible, precioDe } from "../../../lib/cobro";
import { cobroConfigurado } from "../../../lib/mercadopago";
import { pesos } from "../../../lib/precios";
import CabeceraPanel from "../cabecera";
import { cancelarPlan, contratarPlan } from "./actions";

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
};

const ERRORES = {
  plan: "Ese plan no existe.",
  ficha: "Ese restaurante no es tuyo.",
  cobro: "El cobro todavía no está habilitado. Escríbenos y te avisamos cuando lo esté.",
  pasarela: "La pasarela de pago no respondió. Inténtalo otra vez en un momento.",
};

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

  return (
    <div className="panel-wrap">
      <CabeceraPanel correo={auth.user.email} usuarioId={auth.user.id} atras="/panel" />

      <main className="wrap panel-main">
        <h1>Planes</h1>
        <p className="panel-lead">
          Tres planes, sin letras chiquitas. Publicar tu restaurante con su
          menú no cuesta; los de paga son para cuando necesites más menús y
          quieras destacar. Se cobran por restaurante, cada mes, y se cancelan
          cuando quieras.
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
          Se paga con tarjeta, y en México también en OXXO o por SPEI, a través
          de Mercado Pago. Quien esté en la lista de espera conserva el precio
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
                return (
                  <li className="fila-plan" key={r.id}>
                    <div className="fila-plan-nombre">
                      {r.name}
                      {suscripcion ? (
                        <small className="fila-plan-detalle">
                          {estado.nombre}
                          {vigente !== "basico" && r.premium_until
                            ? ` · ${suscripcion.status === "cancelled" ? "hasta" : "vigente hasta"} el ${fechaCorta(r.premium_until)}`
                            : ""}
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
                      {PLANES.filter((p) => p.slug !== "basico" && p.slug !== (viva ? suscripcion.plan : vigente)).map(
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
