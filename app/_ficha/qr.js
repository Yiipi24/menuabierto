import { qrRuta } from "../../lib/qr";

// El SVG del código. Lo pintan dos pantallas —la ficha pública y el panel de
// cada menú—, así que vive aparte en vez de estar copiado en las dos.
export default function Qr({ texto, titulo }) {
  const { d, lado, margen } = qrRuta(texto);
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${lado} ${lado}`}
      role="img"
      aria-label={titulo}
      shapeRendering="crispEdges"
    >
      <rect width={lado} height={lado} fill="#ffffff" />
      <g transform={`translate(${margen} ${margen})`} fill="var(--ink)">
        <path d={d} />
      </g>
    </svg>
  );
}
