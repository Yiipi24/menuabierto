import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import ReclamarForm from "./form";

export const metadata = {
  title: "Reclama tu restaurante — Menú Abierto",
  description:
    "¿Tu restaurante ya está en Menú Abierto? Reclámalo para controlar su menú, sus fotos y sus precios.",
};

export default async function Reclamar() {
  if (!(await currentUser())) {
    // Sin sesión no hay a quién asignarle la ficha. Volvemos aquí después.
    redirect("/entrar?next=/reclamar");
  }

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Link className="brand" href="/panel">
          <span className="brand-mark">M</span>
          Menú Abierto
        </Link>
        <Link className="btn-texto" href="/panel">
          Volver
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <h1>Reclama tu restaurante</h1>
        <p className="panel-lead">
          Si tu restaurante ya aparece en Menú Abierto porque nosotros lo
          cargamos, reclámalo y pasa a controlarlo tú: menú, precios, fotos y
          horarios.
        </p>
        <ReclamarForm />
      </main>
    </div>
  );
}
