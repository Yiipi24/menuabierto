import { canalesDeSoporte } from "../../lib/soporte";

// Los botones para escribirnos. Es la misma pieza en /ayuda, arriba y al
// final, para que el WhatsApp que se prenda con `SOPORTE_WHATSAPP` aparezca
// en los dos lados sin que nadie lo agregue a mano.
export default function ContactoDeSoporte({
  asunto = "Ayuda con Menú Abierto",
  mensaje = "Hola, tengo una duda sobre Menú Abierto.",
}) {
  const canales = canalesDeSoporte({ asunto, mensaje });

  return (
    <div className="ayuda-canales">
      {canales.map((c, i) => (
        <a
          key={c.tipo}
          className={i === 0 ? "btn" : "btn-linea"}
          href={c.href}
          {...(c.tipo === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <span>{c.etiqueta}:</span> {c.texto}
        </a>
      ))}
    </div>
  );
}
