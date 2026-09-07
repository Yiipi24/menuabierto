// El <script> con los datos estructurados. Va en un componente y no suelto en
// cada página porque la parte delicada es siempre la misma: el JSON se escribe
// dentro del HTML, y un nombre de restaurante con "</script>" dentro cerraría
// la etiqueta y dejaría el resto como marcado de la página.
//
// Los nombres y las reseñas los escriben los dueños y los comensales, así que
// se escapa el "<" en su forma escapada de JSON: dice exactamente lo mismo,
// y ya no hay manera de cerrar la etiqueta desde un dato.
export default function DatosEstructurados({ datos }) {
  if (!datos) return null;
  const json = JSON.stringify(datos).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
