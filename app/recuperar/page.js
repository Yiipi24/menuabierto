import Link from "next/link";
import { redirect } from "next/navigation";
import Brand from "../brand";
import { currentUser } from "../../lib/supabase";
import RecuperarForm from "./form";

export const metadata = {
  title: "Recuperar contraseña — Menú Abierto",
  description: "Recupera el acceso a tu cuenta de Menú Abierto.",
};

export default async function Recuperar() {
  if (await currentUser()) redirect("/panel/cuenta");

  return (
    <main className="panel-shell">
      <div className="panel-card">
        <Brand href="/" />

        <h1>Recupera tu contraseña</h1>
        <p className="panel-lead">
          Escribe tu correo y te mandamos un enlace para elegir una nueva.
        </p>

        <RecuperarForm />

        <p className="panel-pie">
          ¿La recordaste? <Link href="/entrar">Entra aquí</Link>.
        </p>
      </div>
    </main>
  );
}
