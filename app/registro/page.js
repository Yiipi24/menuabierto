import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import RegistroForm from "./form";
import Brand from "../brand";

export const metadata = {
  title: "Crear cuenta — Menú Abierto",
  description: "Crea tu cuenta en Menú Abierto.",
};

export default async function Registro() {
  if (await currentUser()) redirect("/panel");

  return (
    <main className="panel-shell">
      <div className="panel-card">
        <Brand href="/" />

        <h1>Crea tu cuenta</h1>
        <p className="panel-lead">
          Es gratis, tanto para buscar dónde comer como para publicar tu
          restaurante.
        </p>

        <RegistroForm />

        <p className="panel-pie">
          ¿Ya tienes cuenta? <Link href="/entrar">Entra aquí</Link>.
        </p>
      </div>
    </main>
  );
}
