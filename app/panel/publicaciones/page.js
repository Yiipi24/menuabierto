import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/supabase";
import CabeceraPanel from "../cabecera";
import Nuevo from "./nuevo";
import Lista from "./lista";
import { conexionesDeRedes, misPublicaciones, misRestaurantes } from "./actions";

export const metadata = { title: "Historias y publicaciones — Menú Abierto" };
export const dynamic = "force-dynamic";

// La pantalla del dueño. Una sola para todos sus restaurantes y no una dentro
// de cada ficha: quien tiene cuatro sucursales publica lo mismo en las cuatro,
// y obligarle a entrar cuatro veces era justo el trabajo que las casillas de
// "seleccionar todos" vienen a quitar.
export default async function Publicaciones() {
  const usuario = await currentUser();
  if (!usuario) redirect("/entrar?next=%2Fpanel%2Fpublicaciones");

  const [restaurantes, publicaciones, conexiones] = await Promise.all([
    misRestaurantes(),
    misPublicaciones(),
    conexionesDeRedes(),
  ]);

  return (
    <div className="panel-wrap">
      <CabeceraPanel correo={usuario.email} usuarioId={usuario.id} atras="/panel" />

      <main className="wrap wrap-ancho panel-main">
        <div className="panel-encabezado panel-encabezado-post">
          <div>
            <h1>Historias y publicaciones</h1>
            <p className="panel-lead">
              Comparte lo mejor de tu restaurante. Tu contenido se muestra en tu ficha y llega a
              todos tus seguidores.
            </p>
          </div>
        </div>

        {restaurantes.length ? (
          <>
            <Nuevo restaurantes={restaurantes} conexiones={conexiones} />

            <section className="bloque-post">
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
