import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MONEDA } from "../../../../../lib/cobro";
import { PERIODOS_ESTADISTICAS, franjaHoraria, periodoDeEstadisticas } from "../../../../../lib/pedidos";
import { asistenteIncluido } from "../../../../../lib/planes";
import { pesos } from "../../../../../lib/precios";
import { supabaseSession } from "../../../../../lib/supabase";
import { entregaDe } from "../../../../../lib/whatsapp";
import CabeceraPanel from "../../../cabecera";

export const metadata = { title: "Estadísticas de pedidos — Menú Abierto" };

const NUMERO = new Intl.NumberFormat("es-MX");

// Las cuentas de los pedidos que tomó el asistente: cuántos, cuánto, qué y
// cuándo. Las hace la base (`estadisticas_de_pedidos`), que con la sesión del
// dueño solo ve sus pedidos. Números y listas, sin gráfica: con un puñado de
// pedidos al día, una lista ordenada dice lo mismo y se lee más rápido.
export default async function EstadisticasDePedidos({ params, searchParams }) {
  const { id } = await params;
  const dias = periodoDeEstadisticas((await searchParams)?.dias);

  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, plan, premium_until")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!restaurante) notFound();

  const { data: datos, error } = await supabase.rpc("estadisticas_de_pedidos", { rid: id, dias });
  if (error) console.error("pedidos: no se pudieron leer las estadísticas", error.message);

  const hay = Number(datos?.pedidos ?? 0) > 0;
  const entregas = Object.entries(datos?.entregas ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="panel-wrap">
      <CabeceraPanel
        correo={auth.user.email}
        usuarioId={auth.user.id}
        marca="/panel"
        atras={`/panel/${id}/pedidos`}
        atrasTexto="Volver a los pedidos"
      />

      <main className="wrap panel-main">
        <div className="panel-encabezado">
          <div>
            <h1>Estadísticas de pedidos</h1>
            <p className="panel-lead panel-lead-pegado">
              {restaurante.name}, últimos {dias} días. Lo vendido es de referencia: sale de los precios
              de tu carta cuando se hizo cada pedido, y no cuenta los cancelados.
            </p>
          </div>
        </div>

        <nav className="estadisticas-periodo" aria-label="Periodo">
          {PERIODOS_ESTADISTICAS.map((d) => (
            <Link
              key={d}
              className={d === dias ? "btn btn-sm" : "btn-linea btn-sm"}
              href={`/panel/${id}/pedidos/estadisticas?dias=${d}`}
              aria-current={d === dias ? "page" : undefined}
            >
              {d} días
            </Link>
          ))}
        </nav>

        {error ? (
          <p className="form-msg err" role="alert">
            No pudimos leer tus estadísticas. Inténtalo otra vez en un momento.
          </p>
        ) : !hay ? (
          <div className="vacio">
            <h2>Todavía no hay pedidos en estos días</h2>
            <p>
              {asistenteIncluido(restaurante)
                ? "Cuando el asistente tome pedidos por WhatsApp, aquí ves cuántos llegan, qué piden y a qué hora."
                : "Los pedidos los toma el asistente de WhatsApp, que viene con el plan Pedidos."}
            </p>
            {asistenteIncluido(restaurante) ? null : (
              <Link className="btn" href="/panel/planes">
                Ver el plan Pedidos
              </Link>
            )}
          </div>
        ) : (
          <>
            <ul className="kpis kpis-cuatro">
              <li className="kpi">
                <p className="kpi-nombre">Pedidos</p>
                <p className="kpi-valor">{NUMERO.format(datos.pedidos)}</p>
                <p className="kpi-nota">
                  {NUMERO.format(datos.entregados)} entregados · {NUMERO.format(datos.cancelados)} cancelados
                </p>
              </li>
              <li className="kpi">
                <p className="kpi-nombre">Vendido</p>
                <p className="kpi-valor">{pesos(datos.vendido_cents, MONEDA)}</p>
                <p className="kpi-nota">
                  De {NUMERO.format(datos.con_total)} {datos.con_total === 1 ? "pedido" : "pedidos"} con precio
                </p>
              </li>
              <li className="kpi">
                <p className="kpi-nombre">Ticket promedio</p>
                <p className="kpi-valor">
                  {datos.ticket_promedio_cents == null ? "—" : pesos(datos.ticket_promedio_cents, MONEDA)}
                </p>
                <p className="kpi-nota">Por pedido, sin cancelados</p>
              </li>
              <li className="kpi">
                <p className="kpi-nombre">Por atender</p>
                <p className="kpi-valor">{NUMERO.format(datos.abiertos)}</p>
                <p className="kpi-nota">Nuevos, aceptados o listos</p>
              </li>
            </ul>

            <div className="estadisticas-listas">
              <section className="estadistica">
                <h2>Lo que más piden</h2>
                {datos.platillos.length ? (
                  <ol>
                    {datos.platillos.map((p) => (
                      <li key={p.nombre}>
                        <span>{p.nombre}</span>
                        <strong>{NUMERO.format(p.cantidad)}</strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="kpi-nota">Los pedidos de estos días son de texto libre.</p>
                )}
              </section>

              <section className="estadistica">
                <h2>A qué hora piden</h2>
                <ol>
                  {datos.horas.map((h) => (
                    <li key={h.hora}>
                      <span>{franjaHoraria(h.hora)}</span>
                      <strong>
                        {NUMERO.format(h.pedidos)} {h.pedidos === 1 ? "pedido" : "pedidos"}
                      </strong>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="estadistica">
                <h2>Cómo los piden</h2>
                <ul>
                  {entregas.map(([slug, n]) => (
                    <li key={slug}>
                      <span>{entregaDe(slug)?.nombre ?? "Sin decir"}</span>
                      <strong>{NUMERO.format(n)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
