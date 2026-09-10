import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { esRestaurantero } from "../../../lib/destino";
import CuentaForm from "./form";
import RedesDeCuenta from "./redes";
import FotoDeCuenta from "./foto";
import CabeceraPanel from "../cabecera";
import { conteoDe, insigniaActual } from "../../../lib/insignias";
import { fotoDeCuenta } from "../../../lib/avatar";
import { IconoInsignia } from "../../insignias-iconos";
import { redesDeLaCuenta } from "./actions";
import AvisosDeCuenta from "./avisos";
import { prefsDe } from "../../../lib/avisos";

export const metadata = { title: "Tu cuenta — Menú Abierto" };

export default async function Cuenta() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // Lo que la persona lleva escrito como comensal. Es lo que la cuenta puede
  // contar de ella además del correo, y la puerta a la página de insignias.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("reviews_count, push_prefs")
    .eq("id", auth.user.id)
    .maybeSingle();

  // El "volver" del comensal no puede apuntar al panel: ahi no tiene nada y
  // ademas lo devolveria a esta misma pagina.
  const restaurantero = await esRestaurantero(auth.user);
  const atras = restaurantero ? "/panel" : "/";

  const foto = await fotoDeCuenta(auth.user.id);
  const identidades = await redesDeLaCuenta();
  const resenas = conteoDe(perfil?.reviews_count);
  const insignia = insigniaActual(resenas);

  // Supabase no expone "tiene contraseña" directamente; que exista el
  // proveedor 'email' entre las identidades es la señal disponible.
  const tieneContrasena = Boolean(
    auth.user.identities?.some((i) => i.provider === "email"),
  );

  return (
    <div className="panel-wrap">
      <CabeceraPanel correo={auth.user.email} usuarioId={auth.user.id} atras={atras} />

      <main className="wrap panel-main panel-angosto">
        <h1>Tu cuenta</h1>

        <h2 className="sub">Tu foto</h2>
        <FotoDeCuenta foto={foto} />

        <div className="dato">
          <span className="dato-etiqueta">Correo</span>
          <strong>{auth.user.email}</strong>
        </div>

        <div className="dato">
          <span className="dato-etiqueta">Reseñas escritas</span>
          <strong>{resenas}</strong>
        </div>

        <h2 className="sub" id="avisos">Tus avisos</h2>
        <p className="panel-lead">
          Historias de los que sigues, reseñas de tu restaurante, respuestas a las
          tuyas e insignias: llegan a <Link href="/avisos">tu bandeja</Link> y, si los
          enciendes, a tu teléfono. <Link href="/instalar">Instala la aplicación</Link>{" "}
          para tenerlos también en iPhone.
        </p>
        <AvisosDeCuenta
          prefs={prefsDe(perfil?.push_prefs)}
          llavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          habilitado={Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)}
        />

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

        {restaurantero ? null : (
          <>
            <h2 className="sub">¿Tienes un restaurante?</h2>
            <p className="panel-lead">
              Publica tu menú, tus fotos y tus precios. Es gratis, y desde ahí
              administras tu ficha.
            </p>
            <Link className="btn-linea" href="/panel/nuevo">
              Dar de alta tu restaurante
            </Link>
          </>
        )}

        <h2 className="sub">Tus redes sociales</h2>
        <p className="panel-lead">
          Vincula una red para entrar con ella, sin escribir contraseña ni esperar
          el correo. No publicamos nada en tu nombre ni leemos tus cuentas.
        </p>

        <RedesDeCuenta identidades={identidades} />

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
