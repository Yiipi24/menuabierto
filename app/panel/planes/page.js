import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { PLANES, menusIncluidos, nombreDelPlan, planVigente } from "../../../lib/planes";
import Brand from "../../brand";

export const metadata = { title: "Planes — Menú Abierto" };

// El catálogo de planes vive en lib/planes.js: la sección de menús necesita
// los mismos números para decir "3 de 5", y dos listas separadas se separan
// más. Estaba en la portada, donde lo leía sobre todo gente buscando dónde
// comer, a la que no le interesa lo que cuesta publicar. Aquí lo ve quien
// tiene un restaurante, que es de quien habla.

export default async function Planes() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // Los planes son los mismos para todos, pero saber en cuál está cada ficha
  // es lo único que esta página añade a lo que decía la portada.
  const { data: restaurantes } = await supabase
    .from("restaurants")
    .select("id, name, plan, premium_until")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  // Cuántos menús tiene cada ficha, para poder decir "3 de 5" también aquí.
  const ids = (restaurantes ?? []).map((r) => r.id);
  const { data: menus } = ids.length
    ? await supabase.from("menus").select("id, restaurant_id").in("restaurant_id", ids)
    : { data: [] };

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href="/panel">
          Volver
        </Link>
      </header>

      <main className="wrap panel-main">
        <h1>Planes</h1>
        <p className="panel-lead">
          Tres planes, sin letras chiquitas. Publicar tu restaurante con su
          menú no cuesta; los de paga son para cuando necesites más menús y
          quieras destacar.
        </p>

        <div className="plans">
          {PLANES.map((p) => (
            <article
              className={p.destacado ? "plan plan-featured" : "plan"}
              key={p.slug}
            >
              {p.destacado ? <span className="plan-badge">{p.nombre}</span> : null}
              <h2>{p.nombre}</h2>
              <div className="plan-price">
                {p.precio} <span>{p.detalle}</span>
              </div>
              <p className="plan-menus">{p.menus} menús por restaurante</p>
              <ul>
                {p.incluye.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="plan-note">
          Definiremos el precio de Plus y Premium antes del lanzamiento. Quien
          esté en la lista de espera lo conserva el primer año. Mientras tanto,
          todo lo que tienes publicado sigue en Básico, sin costo y sin
          vencimiento. Un plan de paga que vence vuelve a Básico solo: los
          menús de más siguen guardados, pero dejan de verse hasta que renueves
          o borres los que sobren.
        </p>

        {restaurantes?.length ? (
          <>
            <h2 className="sub">Tus restaurantes</h2>
            <ul className="lista-planes">
              {restaurantes.map((r) => {
                const usados = (menus ?? []).filter(
                  (m) => m.restaurant_id === r.id,
                ).length;
                return (
                  <li className="fila-plan" key={r.id}>
                    <span className="fila-plan-nombre">{r.name}</span>
                    <span
                      className={
                        planVigente(r) === "basico"
                          ? "estado"
                          : "estado estado-publicado"
                      }
                    >
                      {nombreDelPlan(r)}
                    </span>
                    <span className="cupo">
                      {usados} de {menusIncluidos(r)} menús
                    </span>
                    <Link className="btn-texto" href={`/panel/${r.id}/menus`}>
                      Menús
                    </Link>
                    <Link className="btn-texto" href={`/panel/${r.id}`}>
                      Editar ficha
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="vacio">
            <h2>Todavía no tienes ningún restaurante</h2>
            <p>
              Da de alta el primero para ver aquí en qué plan está y cuántos
              menús te quedan. Empezar es gratis.
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
