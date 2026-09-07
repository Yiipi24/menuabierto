import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import NuevoForm from "./form";
import CabeceraPanel from "../cabecera";
import { esRestaurantero } from "../../../lib/destino";

export const metadata = { title: "Agregar restaurante — Menú Abierto" };

export default async function Nuevo() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // Quien todavia no administra nada llega aqui desde su cuenta, no desde
  // el panel, asi que ahi lo devolvemos si se arrepiente.
  const atras = (await esRestaurantero(auth.user)) ? "/panel" : "/panel/cuenta";

  const { data: cuisines } = await supabase
    .from("cuisines")
    .select("slug, name")
    .order("name");

  return (
    <div className="panel-wrap">
      <CabeceraPanel correo={auth.user.email} atras={atras} />

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
