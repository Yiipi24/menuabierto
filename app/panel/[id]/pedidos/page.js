import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cerradosDesde } from "../../../../lib/pedidos";
import { asistenteIncluido } from "../../../../lib/planes";
import { supabaseSession } from "../../../../lib/supabase";
import { telefonoLegible } from "../../../../lib/whatsapp";
import CabeceraPanel from "../../cabecera";
import { ListaPedidos } from "./lista";

export const metadata = { title: "Pedidos — Menú Abierto" };

const COLUMNAS =
  "id, code, status, status_at, origin, customer_name, customer_phone, delivery, address, lat, lng, notes, details, items, total_cents, currency, created_at";

// Los pedidos que llegan por el asistente de WhatsApp, para atenderlos. La
// pantalla se refresca sola cada pocos segundos: se deja abierta en la
// tableta del mostrador, como la de las aplicaciones de reparto.
export default async function Pedidos({ params }) {
  const { id } = await params;
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, slug, whatsapp_orders, plan, premium_until")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!restaurante) notFound();

  const desde = cerradosDesde();
  const [{ data: linea }, { data: abiertos }, { data: cerrados }] = await Promise.all([
    supabase
      .from("whatsapp_lines")
      .select("display_phone, is_active, answers_in_app")
      .eq("restaurant_id", id)
      .maybeSingle(),
    // Los abiertos, del más viejo al más nuevo: es el orden en que se cocinan.
    supabase
      .from("orders")
      .select(COLUMNAS)
      .eq("restaurant_id", id)
      .in("status", ["nuevo", "aceptado", "listo"])
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("orders")
      .select(COLUMNAS)
      .eq("restaurant_id", id)
      .in("status", ["entregado", "cancelado"])
      .gte("status_at", desde)
      .order("status_at", { ascending: false })
      .limit(50),
  ]);

  // El asistente es del plan Pedidos: conectado y sin el plan vigente, no
  // contesta, igual que pausado.
  const conPlan = asistenteIncluido(restaurante);
  const conectado = Boolean(linea?.is_active) && conPlan;

  return (
    <div className="panel-wrap">
      <CabeceraPanel
        correo={auth.user.email}
        usuarioId={auth.user.id}
        marca="/panel"
        atras={`/panel/${id}`}
        atrasTexto="Volver a la ficha"
      />

      <main className="wrap panel-main panel-taller">
        <div className="panel-encabezado">
          <div>
            <h1>Pedidos de {restaurante.name}</h1>
            <p className="panel-lead panel-lead-pegado">
              {conectado
                ? `Tu asistente contesta el WhatsApp ${telefonoLegible(linea.display_phone)}: el horario, el menú, la dirección y los pedidos. Los pedidos llegan aquí; al aceptarlos, marcarlos listos o cancelarlos, el cliente recibe el aviso en el mismo chat.`
                : "Aquí llegan los pedidos que toma el asistente de WhatsApp de tu restaurante."}
            </p>
          </div>
        </div>

        {!linea && !conPlan ? (
          <div className="pedidos-aviso">
            <strong>El asistente de WhatsApp viene con el plan Pedidos.</strong>
            <p>
              Conectado a tu número, contesta solo a qué hora abres, dónde estás y cuál es tu página;
              manda tu menú, y toma los pedidos platillo por platillo con los precios de tu carta. Lee
              tu menú de aquí, así que cualquier cambio que hagas ya lo tiene.{" "}
              <Link href="/panel/planes">Ver el plan Pedidos</Link>.
            </p>
          </div>
        ) : !linea ? (
          <div className="pedidos-aviso">
            <strong>Tu asistente de WhatsApp todavía no está conectado.</strong>
            <p>
              Ya tienes el plan Pedidos: lo conectamos contigo a tu número en una videollamada. Escríbenos
              a <a href="mailto:hola@menuabierto.com">hola@menuabierto.com</a> para agendarla.
            </p>
          </div>
        ) : !conPlan ? (
          <div className="pedidos-aviso">
            <strong>Tu asistente está en pausa.</strong>
            <p>
              El plan Pedidos de este restaurante no está vigente, y sin él el asistente no contesta
              mensajes ni toma pedidos. Renuévalo en <Link href="/panel/planes">Planes</Link>.
              {linea.answers_in_app
                ? " Mientras tanto, los mensajes te llegan a tu app de WhatsApp Business, como siempre."
                : " Mientras tanto, nadie contesta en ese número: tu botón de pedir y tu carta mandan ahí. Si no vas a renovar, escríbenos a hola@menuabierto.com para desconectarlo."}
            </p>
          </div>
        ) : !conectado ? (
          <div className="pedidos-aviso">
            <strong>Tu asistente está pausado.</strong>
            <p>
              No contesta mensajes ni toma pedidos. Escríbenos a{" "}
              <a href="mailto:hola@menuabierto.com">hola@menuabierto.com</a> para reactivarlo.
            </p>
          </div>
        ) : !restaurante.whatsapp_orders ? (
          <div className="pedidos-aviso">
            <strong>Tienes los pedidos apagados.</strong>
            <p>
              El asistente contesta preguntas, pero a quien quiere pedir le dice que por ahora no tomas
              pedidos por WhatsApp. Préndelos en <Link href={`/panel/${id}`}>tu ficha</Link>, en
              &ldquo;Pedidos por WhatsApp&rdquo;.
            </p>
          </div>
        ) : null}

        <ListaPedidos
          id={id}
          pedidos={[...(abiertos ?? []), ...(cerrados ?? [])]}
          conectado={conectado}
          sinPlan={Boolean(linea) && !conPlan}
        />
      </main>
    </div>
  );
}
