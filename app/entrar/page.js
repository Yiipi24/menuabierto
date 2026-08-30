import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import EntrarForm from "./form";

export const metadata = {
  title: "Entrar — Menú Abierto",
  description: "Entra a tu cuenta para administrar tu restaurante.",
};

export default async function Entrar() {
  if (await currentUser()) {
    redirect("/panel");
  }

  return (
    <main className="panel-shell">
      <div className="panel-card">
        <Link className="brand" href="/">
          <span className="brand-mark">M</span>
          Menú Abierto
        </Link>

        <h1>Entra sin contraseña</h1>
        <p className="panel-lead">
          Escribe tu correo y te mandamos un enlace. No hay contraseña que
          recordar ni que perder.
        </p>

        <EntrarForm />

        <p className="panel-pie">
          ¿Todavía no publicas tu restaurante? Con este mismo enlace creas tu
          cuenta y lo das de alta.
        </p>
      </div>
    </main>
  );
}
