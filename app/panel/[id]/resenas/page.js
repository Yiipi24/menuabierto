import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../lib/supabase";
import { rutaFicha } from "../../../../lib/slug";
import CabeceraPanel from "../../cabecera";
import RespuestaDueno from "../../../_ficha/respuesta-dueno";
import Reportar from "../../../_ficha/reportar";
import { MarcaVerificada } from "../../../_ficha/lista-resenas";
import { resumenVerificadas } from "../../../../lib/pases";

export const metadata = { title: "Reseñas — Menú Abierto" };

const FECHA = new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "long", day: "numeric" });

function Estrellas({ valor }) {
  const llenas = Math.round(valor);
  return (
    <span className="estrellas" aria-label={`${valor} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= llenas ? "estrella-llena" : "estrella-vacia"}>
          ★
        </span>
      ))}
    </span>
  );
}

// Las reseñas del restaurante, para responderlas. Usa la misma función que
// la ficha pública —resenas_restaurante— así que el dueño ve exactamente lo
// que ve un comensal, más la marca de "en revisión" de las reportadas.
export default async function ResenasDelPanel({ params }) {
  const { id } = await params;
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, slug, status, rating_avg, rating_count")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!restaurante) notFound();

  const { data: resenas } = await supabase.rpc("resenas_restaurante", { rid: restaurante.id });
  const lista = resenas ?? [];
  const sinResponder = lista.filter((r) => !r.owner_reply).length;
  const reportadas = lista.filter((r) => r.report_pending).length;
  const verificadas = resumenVerificadas(lista);
  const volverA = `/panel/${id}/resenas`;

  return (
    <div className="panel-wrap">
      <CabeceraPanel correo={auth.user.email} usuarioId={auth.user.id} marca="/panel" atras={`/panel/${id}`} atrasTexto="Volver a la ficha" />

      <main className="wrap panel-main panel-taller">
        <h1>Reseñas de {restaurante.name}</h1>
        <p className="panel-lead">
          {lista.length
            ? `${lista.length} ${lista.length === 1 ? "reseña" : "reseñas"}, promedio ${restaurante.rating_avg ?? "—"}.${sinResponder ? ` ${sinResponder} sin responder.` : " Todas respondidas."}${reportadas ? ` ${reportadas} en revisión.` : ""}${verificadas.verificadas ? ` ${verificadas.verificadas} ${verificadas.verificadas === 1 ? "verificada" : "verificadas"} por escaneo del QR (promedio ${verificadas.promedioVerificadas}).` : ""}`
            : restaurante.status === "publicado"
              ? "Todavía no tienes reseñas. Llegan cuando un comensal registrado califica tu ficha."
              : "Tu ficha no está publicada, así que nadie puede reseñarla todavía."}
        </p>

        <p className="ayuda">
          Una respuesta por reseña, pública y editable. Contesta corto y sin pelear: la
          leen los que todavía no han venido. Si una reseña no es de un cliente de
          verdad, repórtala y la revisamos a mano; mientras tanto sigue visible.
        </p>

        {lista.length ? (
          <ul className="resena-lista resena-lista-panel">
            {lista.map((r) => (
              <li className="resena" key={r.id}>
                <div className="resena-cabeza">
                  <span className="resena-autor">
                    {r.author_name}
                    {r.verified_at ? <MarcaVerificada /> : null}
                  </span>
                  <span className="resena-fecha">{FECHA.format(new Date(r.created_at))}</span>
                </div>
                <Estrellas valor={r.rating} />
                {r.body ? <p className="resena-texto">{r.body}</p> : <p className="resena-texto resena-sin-texto">Sin comentario.</p>}

                {r.owner_reply ? (
                  <div className="resena-respuesta">
                    <span className="resena-respuesta-quien">Tu respuesta</span>
                    <p className="resena-texto">{r.owner_reply}</p>
                  </div>
                ) : null}

                {r.report_pending ? (
                  <p className="resena-en-revision">Reportada: en revisión. Sigue visible hasta que se resuelva.</p>
                ) : null}

                <RespuestaDueno slug={restaurante.slug} reviewId={r.id} respuesta={r.owner_reply} />
                {r.report_pending ? null : (
                  <Reportar slug={restaurante.slug} reviewId={r.id} usuarioId={auth.user.id} volverA={volverA} />
                )}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="ayuda">
          <Link href={`${rutaFicha(restaurante.slug)}#resenas`}>Ver las reseñas en tu ficha</Link>
        </p>
      </main>
    </div>
  );
}
