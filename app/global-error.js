"use client";

// Último recurso: si falla el propio layout raíz, este componente reemplaza
// todo el documento, así que trae su own <html> y estilos mínimos.
export default function GlobalError({ reset }) {
  return (
    <html lang="es-MX">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f5f1ea",
          color: "#1c1917",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>Algo salió mal</h1>
          <p style={{ color: "#57534e", marginBottom: 22 }}>
            No pudimos cargar la página. Vuelve a intentarlo.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              background: "#1c1917",
              color: "#fdfcfa",
              border: 0,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
