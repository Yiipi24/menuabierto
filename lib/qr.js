import qrcode from "qrcode-generator";

// El QR se dibuja como un solo <path>: un rectángulo por módulo serían cientos
// de nodos en el HTML y el navegador tarda más en pintarlos que en leer la ruta.
//
// Corrección de errores media: el código sobrevive a una impresión sucia o a un
// vinil rayado en la mesa, que es donde termina viviendo este QR.
export function qrRuta(texto) {
  const qr = qrcode(0, "M");
  qr.addData(String(texto));
  qr.make();

  const modulos = qr.getModuleCount();
  let d = "";
  for (let fila = 0; fila < modulos; fila += 1) {
    for (let col = 0; col < modulos; col += 1) {
      if (qr.isDark(fila, col)) d += `M${col} ${fila}h1v1h-1z`;
    }
  }

  // El margen de cuatro módulos no es decorativo: sin esa zona en blanco
  // muchas cámaras no encuentran el código.
  const margen = 4;
  return { d, modulos, lado: modulos + margen * 2, margen };
}
