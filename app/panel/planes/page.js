import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import Brand from "../../brand";

export const metadata = { title: "Planes — Menú Abierto" };

// Esto vivía en la portada, donde lo leía sobre todo gente buscando dónde
// comer, a la que no le interesa lo que cuesta publicar. Aquí lo ve quien
// tiene un restaurante, que es de quien habla.
const PLANES = [
  {
    slug: "basico",
    nombre: "Básico",
    precio: "Gratis",
    detalle: "para siempre",
    incluye: [
      "Perfil del restaurante con ubicación y horarios",
      "Menú completo con precios",
      "Hasta 10 fotos",
      "Aparece en las búsquedas de tu zona",
    ],
  },
  {
    slug: "premium",
    nombre: "Premium",
    precio: "Mensual",
    detalle: "precio al lanzamiento",
    destacado: true,
    incluye: [
      "Todo lo del plan Básico",
      "Posición destacada en tu zona y tu categoría",
      "Fotos ilimitadas y video del local",
      "Promociones y menú del día",
      "Estadísticas de visitas y búsquedas",
    ],
  },
];

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

  const ahora = Date.now();
  const enPremium = (r) =>
    r.plan === "premium" &&
    (!r.premium_until || new Date(r.premium_until).getTime() > ahora);

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
          Dos planes, sin letras chiquitas. Publicar tu restaurante no cuesta;
          Premium es para cuando quieras destacar.
        </p>

        <div className="plans">
          {PLANES.map((p) => (
            <article
              className={p.destacado ? "plan plan-featured" : "plan"}
              key={p.slug}
            >
              {p.destacado ? <span className="plan-badge">Premium</span> : null}
              <h2>{p.nombre}</h2>
              <div className="plan-price">
                {p.precio} <span>{p.detalle}</span>
              </div>
              <ul>
                {p.incluye.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="plan-note">
          Definiremos el precio de Premium antes del lanzamiento. Quien esté en
          la lista de espera lo conserva el primer año. Mientras tanto, todo lo
          que tienes publicado sigue en Básico, sin costo y sin vencimiento.
        </p>

        {restaurantes?.length ? (
          <>
            <h2 className="sub">Tus restaurantes</h2>
            <ul className="lista-planes">
              {restaurantes.map((r) => (
                <li className="fila-plan" key={r.id}>
                  <span className="fila-plan-nombre">{r.name}</span>
                  <span
                    className={
                      enPremium(r) ? "estado estado-publicado" : "estado"
                    }
                  >
                    {enPremium(r) ? "Premium" : "Básico"}
                  </span>
                  <Link className="btn-texto" href={`/panel/${r.id}`}>
                    Editar ficha
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="vacio">
            <h2>Todavía no tienes ningún restaurante</h2>
            <p>
              Da de alta el primero para ver aquí en qué plan está. Empezar es
              gratis.
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
