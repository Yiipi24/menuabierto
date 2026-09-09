import Link from "next/link";

export const metadata = { title: "Sin conexión — Menú Abierto" };

// La página que el service worker guarda para cuando no hay red. Estática a
// propósito: no necesita nada de la base, que es justo lo que no hay.
export default function SinConexion() {
  return (
    <main className="panel-shell">
      <div className="panel-card">
        <h1>Sin conexión</h1>
        <p className="panel-lead">
          No pudimos cargar la página. Revisa tu conexión y vuelve a intentarlo: las
          cartas y los precios se leen siempre en vivo, para que nunca veas uno viejo.
        </p>
        <Link className="btn btn-block" href="/">
          Reintentar
        </Link>
      </div>
    </main>
  );
}
