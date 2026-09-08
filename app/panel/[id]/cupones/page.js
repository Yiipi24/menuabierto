import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseSession } from "../../../../lib/supabase";
import { conversion } from "../../../../lib/cupones";
import { rutaFicha } from "../../../../lib/slug";
import CabeceraPanel from "../../cabecera";
import { IconoCupon, IconoFoco } from "../../tablero-iconos";
import { BotonNuevoCupon, CajaDeCanjes, FilaCupon } from "./lista";

export const metadata = { title: "Cupones — Menú Abierto" };

// Los números de la cabecera son de los últimos 30 días. Un cupón se reparte
// por temporadas, así que la semana se queda corta y el histórico completo
// mezcla la promoción de mayo con la de septiembre.
const PERIODO = "30d";

const SIN_DATOS = { vistas: 0, copias: 0, canjes: 0 };

export default async function Cupones({ params }) {
  const { id } = await params;
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, name, slug, status")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!restaurante) notFound();

  // Las cifras salen de la misma función que alimenta el tablero: escribir
  // otra consulta aquí acabaría con dos definiciones de "una vista de cupón".
  const [{ data: cupones }, { data: metricas }] = await Promise.all([
    supabase
      .from("coupons")
      .select(
        "id, code, title, description, terms, kind, value_int, starts_at, ends_at, max_redemptions, redemptions_count, is_active, created_at",
      )
      .eq("restaurant_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("restaurant_metrics", { rid: id, periodo: PERIODO }),
  ]);

  const lista = cupones ?? [];
  const porCupon = new Map(
    (metricas?.cupones ?? []).map((c) => [
      c.id,
      { vistas: Number(c.vistas) || 0, copias: Number(c.copias) || 0, canjes: Number(c.canjes) || 0 },
    ]),
  );

  const suma = (campo) =>
    [...porCupon.values()].reduce((a, c) => a + c[campo], 0);
  const vistas = suma("vistas");
  const copias = suma("copias");
  const canjes = suma("canjes");
  const tasa = conversion(vistas, canjes);
  const activos = lista.filter((c) => c.is_active).length;

  return (
    <div className="panel-wrap">
      <CabeceraPanel
        correo={auth.user.email}
        usuarioId={auth.user.id}
        marca="/panel"
        atras={`/panel/${id}`}
        atrasTexto="Volver a la ficha"
      />

      <main className="wrap panel-main panel-taller">
        <div className="panel-encabezado">
          <div>
            <h1>Cupones</h1>
            <p className="panel-lead panel-lead-pegado">
              Una promoción anunciada no se puede medir. Con un código sí: sale en
              tu ficha, el cliente se lo lleva y lo dice en la caja. Ahí es donde
              sabes cuántos de los que la vieron de verdad vinieron.
            </p>
          </div>
          <BotonNuevoCupon id={id} />
        </div>

        <CajaDeCanjes id={id} hayCupones={lista.length > 0} />

        {lista.length ? (
          <>
            <section className="cupones-resumen">
              <h2 className="sr-only">Resultados de los últimos 30 días</h2>
              <div className="resumen-caja">
                <span className="resumen-cifra">{vistas}</span>
                <span className="resumen-nombre">Vistas de tus cupones</span>
              </div>
              <div className="resumen-caja">
                <span className="resumen-cifra">{copias}</span>
                <span className="resumen-nombre">Códigos copiados</span>
              </div>
              <div className="resumen-caja">
                <span className="resumen-cifra">{canjes}</span>
                <span className="resumen-nombre">Canjes en la caja</span>
              </div>
              <div className="resumen-caja resumen-caja-fuerte">
                <span className="resumen-cifra">{tasa == null ? "—" : `${tasa}%`}</span>
                <span className="resumen-nombre">Conversión</span>
              </div>
              <p className="resumen-nota">Últimos 30 días.</p>
            </section>

            <section className="tarjeta-lista">
              <header className="tarjeta-lista-top">
                <h2>
                  Tus cupones{" "}
                  <span className="cupo">
                    ({activos} {activos === 1 ? "encendido" : "encendidos"} de {lista.length})
                  </span>
                </h2>
              </header>

              <ul className="lista-cupones">
                {lista.map((c) => (
                  <FilaCupon
                    key={c.id}
                    id={id}
                    cupon={c}
                    metricas={porCupon.get(c.id) ?? SIN_DATOS}
                    periodo="los últimos 30 días"
                  />
                ))}
              </ul>
            </section>
          </>
        ) : (
          <div className="vacio">
            <h2>Todavía no tienes ningún cupón</h2>
            <p>
              Empieza con uno sencillo: un porcentaje sobre la cuenta, con código
              corto y una fecha de fin. Sale en tu ficha junto a tus menús, y cada
              vez que alguien lo diga en la caja lo registras aquí.
            </p>
            <BotonNuevoCupon id={id} texto="Crear el primero" />
          </div>
        )}

        <div className="menus-columnas">
          <div className="menus-columna-ancha">
            {restaurante.status === "publicado" ? (
              <p className="plan-note">
                Tus cupones encendidos se ven en{" "}
                <Link href={rutaFicha(restaurante.slug)}>tu ficha</Link>, arriba de
                los menús.
              </p>
            ) : (
              <p className="plan-note">
                Tu ficha todavía no está publicada, así que nadie puede ver tus
                cupones. <Link href={`/panel/${id}`}>Publícala</Link> para empezar
                a repartirlos.
              </p>
            )}
          </div>

          <aside className="menus-columna-lado">
            <section className="tarjeta-lado">
              <h2>
                <IconoFoco ancho={18} />
                Cupones que sí funcionan
              </h2>
              <ul className="lista-palomitas">
                <li>Códigos cortos y fáciles de decir en voz alta: MARTES2X1.</li>
                <li>Una fecha de fin: sin ella nadie tiene prisa por venir.</li>
                <li>Un tope de canjes para las promociones fuertes.</li>
                <li>Condiciones claras, para no discutirlas en la caja.</li>
                <li>Registra cada canje: es la mitad que dice si sirvió.</li>
              </ul>
            </section>

            <section className="tarjeta-lado">
              <h2>
                <IconoCupon ancho={18} />
                ¿Qué significa cada número?
              </h2>
              <ul className="lista-iconos lista-glosario">
                <li>
                  <strong>Vistas</strong> — cuántas personas vieron el cupón en tu
                  ficha.
                </li>
                <li>
                  <strong>Códigos copiados</strong> — cuántas se llevaron el código.
                </li>
                <li>
                  <strong>Canjes</strong> — cuántas lo dijeron en la caja y tú lo
                  registraste.
                </li>
                <li>
                  <strong>Conversión</strong> — de cada 100 que lo vieron, cuántas
                  vinieron.
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
