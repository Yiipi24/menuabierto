import Link from "next/link";
import { redirect } from "next/navigation";
import { rutaInterna } from "../../lib/rutas";
import { currentUser } from "../../lib/supabase";
import EntrarForm from "./form";
import Brand from "../brand";

export const metadata = {
  title: "Entrar — Menú Abierto",
  description: "Entra a tu cuenta para administrar tu restaurante.",
};

export default async function Entrar({ searchParams }) {
  const params = await searchParams;
  const next = rutaInterna(params?.next);

  // Al destino pedido y no siempre al panel: quien venía de una ficha a dejar
  // su reseña y ya tenía sesión abierta acababa en el panel, lejos del
  // restaurante que estaba viendo.
  if (await currentUser()) {
    redirect(next);
  }

  return (
    <main className="panel-shell">
      <div className="panel-card">
        <Brand href="/" />

        <h1>Entra a tu cuenta</h1>
        <p className="panel-lead">
          Con el correo y la contraseña que registraste.
        </p>

        <EntrarForm next={next} />

        <p className="panel-pie">
          ¿No tienes cuenta? <Link href="/registro">Crea una</Link>.
        </p>
      </div>
    </main>
  );
}
