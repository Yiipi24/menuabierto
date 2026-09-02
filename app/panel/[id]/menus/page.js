import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../lib/supabase";
import { menusIncluidos, nombreDelPlan } from "../../../../lib/planes";
import { nombreDePlantilla } from "../../../../lib/plantillas";
import Brand from "../../../brand";
import NuevoMenu from "./nuevo";
import { cambiarVisibilidadMenu, moverMenu } from "./actions";

export const metadata = { title: "Menús — Menú Abierto" };

export default async function Menus({ params }) {
  const { id } = await params;
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, status, plan, premium_until")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!restaurante) notFound();

  // Las cuentas de secciones y platillos se traen crudas y se agrupan aquí:
  // PostgREST no hace GROUP BY, y son pocas filas por restaurante.
  const [{ data: menus }, { data: secciones }, { data: platillos }] =
    await Promise.all([
      supabase
        .from("menus")
        .select("id, name, kind, template, file_path, is_visible, position")
        .eq("restaurant_id", id)
        .order("position")
        .order("created_at"),
      supabase.from("menu_sections").select("id, menu_id").eq("restaurant_id", id),
      supabase.from("menu_items").select("id, menu_id").eq("restaurant_id", id),
    ]);

  const cuenta = (filas, menuId) =>
    (filas ?? []).filter((f) => f.menu_id === menuId).length;

  const lista = menus ?? [];
  const cupo = menusIncluidos(restaurante);
  const quedan = Math.max(0, cupo - lista.length);

  return (
    <div className="panel-wrap">
      <header className="panel-top">
        <Brand href="/panel" />
        <Link className="btn-texto" href={`/panel/${id}`}>
          Volver a la ficha
        </Link>
      </header>

      <main className="wrap panel-main panel-angosto">
        <div className="panel-encabezado">
          <h1>Menús</h1>
          <span className="cupo">
            {lista.length} de {cupo}
          </span>
        </div>

        <p className="panel-lead">
          Cada menú es una carta aparte: la de comida, la de bebidas, la del
          día. Puedes capturarla platillo por platillo o subir la tuya en PDF.
          Tu plan {nombreDelPlan(restaurante)} incluye {cupo} menús para{" "}
          {restaurante.name}.
        </p>

        {lista.length ? (
          <ul className="lista-menus">
            {lista.map((m, i) => (
              <li className="fila-menu" key={m.id}>
                <div className="fila-menu-datos">
                  <Link className="fila-menu-nombre" href={`/panel/${id}/menus/${m.id}`}>
                    {m.name}
                  </Link>
                  <p className="fila-meta">
                    {m.kind === "archivo"
                      ? m.file_path
                        ? "Archivo subido"
                        : "Archivo · falta subirlo"
                      : `${cuenta(secciones, m.id)} secciones · ${cuenta(
                          platillos,
                          m.id,
                        )} platillos · plantilla ${nombreDePlantilla(m.template)}`}
                  </p>
                </div>

                <div className="fila-derecha">
                  <span className={m.is_visible ? "estado estado-publicado" : "estado"}>
                    {m.is_visible ? "Visible" : "Oculto"}
                  </span>

                  <div className="fila-orden">
                    <form action={moverMenu}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="menu" value={m.id} />
                      <input type="hidden" name="dir" value="arriba" />
                      <button
                        className="btn-orden"
                        type="submit"
                        disabled={i === 0}
                        aria-label={`Subir ${m.name}`}
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moverMenu}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="menu" value={m.id} />
                      <input type="hidden" name="dir" value="abajo" />
                      <button
                        className="btn-orden"
                        type="submit"
                        disabled={i === lista.length - 1}
                        aria-label={`Bajar ${m.name}`}
                      >
                        ↓
                      </button>
                    </form>
                  </div>

                  <div className="fila-botones">
                    <Link className="btn-texto" href={`/panel/${id}/menus/${m.id}`}>
                      Editar
                    </Link>
                    <form action={cambiarVisibilidadMenu}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="menu" value={m.id} />
                      <button className="btn-texto" type="submit">
                        {m.is_visible ? "Ocultar" : "Mostrar"}
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="vacio">
            <h2>Todavía no tienes ningún menú</h2>
            <p>
              Empieza por la carta principal. Le agregas secciones —entradas,
              platos fuertes, bebidas— y dentro de cada una sus platillos con
              precio.
            </p>
          </div>
        )}

        <NuevoMenu id={id} quedan={quedan} cupo={cupo} />

        {quedan === 0 ? (
          <p className="plan-note">
            Llegaste a los {cupo} menús de tu plan. Con un plan más grande
            caben más. <Link href="/panel/planes">Ver los planes</Link>.
          </p>
        ) : null}
      </main>
    </div>
  );
}
