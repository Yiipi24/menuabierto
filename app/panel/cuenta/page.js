import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import CuentaForm from "./form";
import Brand from "../../brand";
import { conteoDe, insigniaActual } from "../../../lib/insignias";
import { IconoInsignia } from "../../insignias-iconos";

export const metadata = { title: "Tu cuenta — Menú Abierto" };

export default async function Cuenta() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // Lo que la persona lleva escrito como comensal. Es lo que la cuenta puede
  // contar de ella además del correo, y la puerta a la página de insignias.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("reviews_count")
    .eq("id", auth.user.id)
    .maybeSingle();

  const resenas = conteoDe(perfil?.reviews_count);
  const insignia = insigniaActual(resenas);

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

        <div className="dato">
          <span className="dato-etiqueta">Reseñas escritas</span>
          <strong>{resenas}</strong>
        </div>

        <h2 className="sub">Tus insignias</h2>
        <p className="panel-lead">
          {insignia
            ? `Vas en "${insignia.nombre}". Cada reseña nueva te acerca a la siguiente meta.`
            : "Se ganan escribiendo reseñas. La primera ya te da una."}
        </p>
        <Link className="btn-linea" href="/panel/insignias">
          {insignia ? <IconoInsignia slug={insignia.slug} ancho={18} /> : null}
          Ver tus insignias
        </Link>

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
