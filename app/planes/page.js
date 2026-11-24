import Link from "next/link";
import Nav from "../nav";
import { CatalogoDePlanes, FormasDePago } from "./catalogo";
import { MONEDA, precioDe } from "../../lib/cobro";
import { pesos } from "../../lib/precios";
import { currentUser } from "../../lib/supabase";
import { IconoTienda } from "../panel/tablero-iconos";

const desde = pesos(precioDe("plus"), MONEDA);

export const metadata = {
  title: "Planes y precios para restaurantes — Menú Abierto",
  description: `Publica tu menú gratis. Los planes de paga empiezan en ${desde} ${MONEDA} al mes más IVA: más menús, más fotos, estadísticas y pedidos por WhatsApp sin comisión.`,
  alternates: { canonical: "/planes" },
};

// Los planes, a la vista de quien todavía no tiene cuenta. Un dueño quiere
// saber cuánto cuesta antes de registrarse, y el panel solo los enseñaba con
// sesión. El catálogo y las formas de pago son los mismos componentes que usa
// /panel/planes; contratar sigue pasando por el panel, con la ficha elegida.
export default async function Planes() {
  const usuario = await currentUser();

  return (
    <>
      <Nav />
      <main className="wrap wrap-ancho panel-main planes-pagina">
        <header className="planes-encabezado">
          <div>
            <h1>Planes para restaurantes</h1>
            <p className="planes-subtitulo">
              Publica tu menú gratis. Paga solo si necesitas más menús, más fotos, estadísticas o
              recibir pedidos por WhatsApp.
            </p>
          </div>
          <div className="planes-por-restaurante">
            <span className="planes-por-restaurante-icono">
              <IconoTienda ancho={22} />
            </span>
            <p>
              <strong>Un plan por restaurante</strong>
              Cada restaurante puede tener un plan diferente, y lo cambias cuando quieras.
            </p>
          </div>
        </header>

        <CatalogoDePlanes />

        <section className="planes-cta" aria-label="Empezar">
          {usuario ? (
            <Link className="btn" href="/panel/planes">
              Elegir el plan de mi restaurante
            </Link>
          ) : (
            <>
              <Link className="btn" href="/registro">
                Crea tu cuenta gratis
              </Link>
              <Link className="btn-linea" href="/reclamar">
                ¿Tu restaurante ya aparece? Reclámalo
              </Link>
            </>
          )}
        </section>

        <FormasDePago />

        <p className="ayuda legal-pie">
          Al contratar aceptas los <Link href="/terminos">Términos y condiciones</Link>. Cómo tratamos
          tus datos está en el <Link href="/privacidad">Aviso de privacidad</Link>.
        </p>
      </main>
    </>
  );
}
