import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/supabase";
import Brand from "../../brand";
import Nuevo from "./nuevo";
import Lista from "./lista";
import { misPublicaciones, misRestaurantes } from "./actions";

export const metadata = { title: "Historias y publicaciones — Menú Abierto" };
export const dynamic = "force-dynamic";

// La pantalla del dueño. Una sola para todos sus restaurantes y no una dentro
// de cada ficha: quien tiene cuatro sucursales publica lo mismo en las cuatro,
// y obligarle a entrar cuatro veces era justo el trabajo que las casillas de
// "seleccionar todos" vienen a quitar.
export default async function Publicaciones() {
  const usuario = await currentUser();
  if (!usuario) redirect("/entrar?next=%2Fpanel%2Fpublicaciones");

  const [restaurantes, publicaciones] = await Promise.all([
    misRestaurantes(),
    misPublicaciones(),
  ]);

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href="/panel">
          Volver
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <div className="panel-encabezado">
          <h1>Historias y publicaciones</h1>
        </div>

        <p className="panel-lead">
          Lo que cuentas hoy sale en tu ficha, encima de la dirección, y le llega
          a quien te sigue.
        </p>

        {restaurantes.length ? (
          <>
            <section className="bloque-post">
              <Nuevo restaurantes={restaurantes} />
            </section>

            <section className="bloque-post">
              <h2 className="sub">Lo que ya publicaste</h2>
              <Lista publicaciones={publicaciones} />
            </section>
          </>
        ) : (
          <div className="vacio">
            <h2>Primero da de alta tu restaurante</h2>
            <p>
              Las historias y las publicaciones salen en la ficha de un
              restaurante, así que hace falta tener uno.
            </p>
            <Link className="btn" href="/panel/nuevo">
              Agregar restaurante
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
