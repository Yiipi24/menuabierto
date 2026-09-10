import Link from "next/link";
import Nav from "../nav";
import BotonInstalar from "./boton";
import { currentUser } from "../../lib/supabase";

export const metadata = {
  title: "Instala Menú Abierto — Menú Abierto",
  description: "Lleva Menú Abierto en tu teléfono: se instala desde el navegador, sin tienda de aplicaciones.",
};

// La pantalla de instalación. Es una página y no un banner porque en iOS no
// hay botón que dispare nada: hay que explicar los tres toques, y para eso
// hace falta espacio.
export default async function Instalar() {
  const usuario = await currentUser();

  return (
    <>
      <Nav />
      <main className="wrap panel-main panel-angosto">
        <h1>Lleva Menú Abierto en tu teléfono</h1>
        <p className="panel-lead">
          Se instala desde el navegador, sin tienda y sin ocupar casi espacio. Abre como
          una aplicación, y con los avisos encendidos te enteras cuando un restaurante que
          sigues publica una historia o cuando te contestan una reseña.
        </p>

        <BotonInstalar />

        <h2 className="sub">Los avisos</h2>
        <p className="ayuda">
          En Android funcionan en cuanto los enciendes. En iPhone, solo después de
          instalar la aplicación y con iOS 16.4 o más nuevo: es una regla de Apple, no
          nuestra. Se encienden y se apagan desde tu cuenta, por tipo de aviso.
        </p>
        {usuario ? (
          <Link className="btn-linea" href="/panel/cuenta#avisos">
            Encender los avisos
          </Link>
        ) : (
          <Link className="btn-linea" href="/entrar?next=%2Fpanel%2Fcuenta%23avisos">
            Entrar para encender los avisos
          </Link>
        )}
      </main>
    </>
  );
}
