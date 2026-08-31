import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import EntrarForm from "./form";

export const metadata = {
  title: "Entrar — Menú Abierto",
  description: "Entra a tu cuenta para administrar tu restaurante.",
};

export default async function Entrar({ searchParams }) {
  const params = await searchParams;
  const pedido = String(params?.next ?? "");
  const next = pedido.startsWith("/") && !pedido.startsWith("//") ? pedido : "/panel";

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

        <h1>Entra a tu cuenta</h1>
        <p className="panel-lead">
          Con tu contraseña, o con un enlace por correo si no la recuerdas.
        </p>

        <EntrarForm next={next} />

        <p className="panel-pie">
          ¿No tienes cuenta? <Link href="/registro">Crea una</Link>.
        </p>
      </div>
    </main>
  );
}
