import Link from "next/link";
import { redirect } from "next/navigation";
import { rutaInterna } from "../../lib/rutas";
import { currentUser } from "../../lib/supabase";
import RegistroForm from "./form";
import Brand from "../brand";

export const metadata = {
  title: "Crear cuenta — Menú Abierto",
  description: "Crea tu cuenta en Menú Abierto.",
};

export default async function Registro({ searchParams }) {
  const params = await searchParams;
  const next = rutaInterna(params?.next, "/");

  if (await currentUser()) redirect(next);

  return (
    <main className="panel-shell">
      <div className="panel-card">
        <Brand href="/" />

        <h1>Crea tu cuenta</h1>
        <p className="panel-lead">
          Es gratis, tanto para buscar dónde comer como para publicar tu
          restaurante.
        </p>

        <RegistroForm next={next} />

        <p className="panel-pie">
          ¿Ya tienes cuenta?{" "}
          <Link href={`/entrar?next=${encodeURIComponent(next)}`}>Entra aquí</Link>.
        </p>
      </div>
    </main>
  );
}
