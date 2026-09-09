import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import ReclamarForm from "./form";
import { fichaParaReclamar } from "./actions";
import Brand from "../brand";

export const metadata = {
  title: "Reclama tu restaurante — Menú Abierto",
  description:
    "¿Tu restaurante ya está en Menú Abierto? Reclámalo para controlar su menú, sus fotos y sus precios.",
};

export default async function Reclamar({ searchParams }) {
  const params = await searchParams;
  const fichaId = typeof params?.ficha === "string" ? params.ficha : null;

  if (!(await currentUser())) {
    // Sin sesión no hay a quién asignarle la ficha. Volvemos aquí después,
    // con la ficha que venía en la URL.
    const volver = fichaId ? `/reclamar?ficha=${encodeURIComponent(fichaId)}` : "/reclamar";
    redirect(`/entrar?next=${encodeURIComponent(volver)}`);
  }

  // Desde el aviso de una ficha no reclamada se llega con la ficha ya elegida.
  const fichaInicial = fichaId ? await fichaParaReclamar(fichaId) : null;

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href="/panel">
          Volver
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <h1>Reclama tu restaurante</h1>
        <p className="panel-lead">
          Si tu restaurante ya aparece en Menú Abierto porque nosotros lo
          cargamos, reclámalo y pasa a controlarlo tú: menú, precios, fotos y
          horarios. Si entras con un correo del mismo dominio que el sitio web
          del restaurante, la ficha es tuya al instante; si no, la revisamos a
          mano.
        </p>
        <ReclamarForm fichaInicial={fichaInicial} />
      </main>
    </div>
  );
}
