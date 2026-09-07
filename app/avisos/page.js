import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/supabase";
import Nav from "../nav";
import ListaAvisos from "./lista";
import { misAvisos } from "../_social/datos";

export const metadata = { title: "Tus avisos — Menú Abierto" };

// La bandeja de avisos. Hoy solo trae historias de restaurantes que sigues con
// la campana encendida; la tabla admite más tipos para cuando los haya.
export default async function Avisos() {
  const usuario = await currentUser();
  if (!usuario) redirect("/entrar?next=%2Favisos");

  const avisos = await misAvisos();

  return (
    <>
      <Nav />

      <main className="feed">
        <div className="wrap panel-angosto">
          <header className="feed-encabezado">
            <div>
              <h1>Tus avisos</h1>
              <p>Cuando un restaurante que sigues publica una historia.</p>
            </div>
            <Link className="btn-linea" href="/novedades">
              Ver novedades
            </Link>
          </header>

          <ListaAvisos avisos={avisos} />
        </div>
      </main>
    </>
  );
}
