import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../lib/supabase";
import { vinoAPublicar } from "../../lib/destino";
import CabeceraPanel from "./cabecera";
import Tablero from "./tablero";
import ListaDeRestaurantes from "./tablero-acciones";
import { metricasDeSeleccion } from "./metricas-actions";
import { PERIODO_POR_DEFECTO } from "../../lib/metricas";
import { IconoCorona, IconoMas } from "./tablero-iconos";

export const metadata = { title: "Tu panel — Menú Abierto" };

const BUCKET_FOTOS = "restaurantes";

export default async function Panel() {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // La RLS ya limita esto a los restaurantes de quien está firmado; el filtro
  // explícito sobra por seguridad pero deja clara la intención al leer.
  const { data: restaurantes, error } = await supabase
    .from("restaurants")
    .select(
      "id, slug, name, city, neighborhood, status, plan, rating_avg, rating_count",
    )
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  // El panel es la casa de los restaurantes: planes, reclamar una ficha,
  // "Tus restaurantes". A quien no administra ninguno ni vino a publicar el
  // suyo nada de eso le habla, asi que su cuenta esta en /panel/cuenta.
  // Si la consulta fallo no lo echamos: abajo se le explica el fallo.
  if (!error && !restaurantes?.length && !vinoAPublicar(auth.user)) {
    redirect("/panel/cuenta");
  }

  // Las fotos sirven para dos cosas en el tablero: la miniatura del selector
  // (la de la fachada) y una de las ideas ("agrega más fotos"). Se piden en
  // una sola consulta para todos y no una por restaurante.
  let fotosPorRestaurante = new Map();
  if (restaurantes?.length) {
    const { data: fotos } = await supabase
      .from("restaurant_media")
      .select("restaurant_id, storage_path, category, position")
      .in(
        "restaurant_id",
        restaurantes.map((r) => r.id),
      )
      .order("position");

    for (const f of fotos ?? []) {
      const actual = fotosPorRestaurante.get(f.restaurant_id) ?? {
        total: 0,
        portada: null,
      };
      actual.total += 1;
      // La miniatura es la fachada; si no hay, la primera foto que exista.
      const esMejor = f.category === "fachada" && actual.portada?.category !== "fachada";
      if (!actual.portada || esMejor) actual.portada = f;
      fotosPorRestaurante.set(f.restaurant_id, actual);
    }
  }

  const conFotos = (restaurantes ?? []).map((r) => {
    const info = fotosPorRestaurante.get(r.id);
    return {
      ...r,
      fotos: info?.total ?? 0,
      foto: info?.portada
        ? supabase.storage.from(BUCKET_FOTOS).getPublicUrl(info.portada.storage_path)
            .data.publicUrl
        : null,
    };
  });

  // Las métricas llegan ya pintadas y con todos los restaurantes sumados, que
  // es como abre el filtro; a partir de ahí las pide el tablero conforme el
  // dueño cambia de selección o de periodo.
  const inicial = conFotos.length
    ? await metricasDeSeleccion(
        conFotos.map((r) => r.id),
        PERIODO_POR_DEFECTO,
      )
    : null;

  return (
    <div className="panel-wrap">
      <CabeceraPanel correo={auth.user.email} />

      <main className="wrap panel-main panel-tablero">
        <div className="panel-encabezado">
          <h1>Tus restaurantes</h1>
          <div className="panel-acciones">
            <Link className="btn-linea" href="/reclamar">
              Reclamar uno existente
            </Link>
            <Link className="btn-linea" href="/panel/publicaciones">
              Historias y publicaciones
            </Link>
            <Link className="btn-linea" href="/panel/insignias">
              Tus insignias
            </Link>
            <Link className="btn-linea" href="/panel/planes">
              <IconoCorona ancho={17} />
              Planes
            </Link>
            <Link className="btn" href="/panel/nuevo">
              <IconoMas ancho={17} />
              Agregar restaurante
            </Link>
          </div>
        </div>

        {error ? (
          <p className="form-msg err">
            No pudimos cargar tus restaurantes. Recarga la página.
          </p>
        ) : null}

        {!error && conFotos.length === 0 ? (
          <div className="vacio">
            <h2>Todavía no tienes ninguno</h2>
            <p>
              Da de alta tu restaurante para empezar. Puedes guardarlo como
              borrador y publicarlo cuando el menú esté listo.
            </p>
            <Link className="btn" href="/panel/nuevo">
              Agregar el primero
            </Link>
          </div>
        ) : null}

        {conFotos.length ? <ListaDeRestaurantes restaurantes={conFotos} /> : null}

        {conFotos.length ? (
          <Tablero
            restaurantes={conFotos}
            periodoInicial={PERIODO_POR_DEFECTO}
            datosIniciales={inicial?.datos ?? null}
            errorInicial={Boolean(inicial?.error)}
          />
        ) : null}
      </main>
    </div>
  );
}
