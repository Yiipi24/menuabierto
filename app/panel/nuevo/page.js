import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import NuevoForm from "./form";
import Brand from "../../brand";

export const metadata = { title: "Agregar restaurante — Menú Abierto" };

export default async function Nuevo() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: cuisines } = await supabase
    .from("cuisines")
    .select("slug, name")
    .order("name");

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href="/panel">
          Volver
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <h1>Agregar restaurante</h1>
        <p className="panel-lead">
          Con el nombre y la ciudad basta para empezar. El menú, las fotos y los
          horarios los cargas después.
        </p>
        <NuevoForm cuisines={cuisines ?? []} />
      </main>
    </div>
  );
}
