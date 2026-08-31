import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import CuentaForm from "./form";
import Brand from "../../brand";

export const metadata = { title: "Tu cuenta — Menú Abierto" };

export default async function Cuenta() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // Supabase no expone "tiene contraseña" directamente; que exista el
  // proveedor 'email' entre las identidades es la señal disponible.
  const tieneContrasena = Boolean(
    auth.user.identities?.some((i) => i.provider === "email"),
  );

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href="/panel">
          Volver
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <h1>Tu cuenta</h1>

        <div className="dato">
          <span className="dato-etiqueta">Correo</span>
          <strong>{auth.user.email}</strong>
        </div>

        <h2 className="sub">Contraseña</h2>
        <p className="panel-lead">
          Es opcional. Siempre puedes entrar con el enlace que te mandamos por
          correo; una contraseña solo te da una segunda forma de hacerlo.
        </p>

        <CuentaForm tieneContrasena={tieneContrasena} />
      </main>
    </div>
  );
}
