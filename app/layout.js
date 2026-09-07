import "./globals.css";
import { SITIO } from "../lib/sitio";
import { imagenesDeCompartir } from "../lib/compartir";

const title = "Menú Abierto — encuentra dónde comer, y haz que te encuentren";
const description =
  "Busca restaurantes por ubicación, tipo de comida, precio y calificación. Si tienes un restaurante, publica tu menú, tus fotos y tus precios, y mantenlos siempre al día.";

// La imagen con la que se comparte el sitio entero. Las páginas que tienen la
// suya —una ficha, una carta— la reemplazan; las demás heredan esta, y así un
// enlace a la portada o al explorador deja de llegar como un recuadro gris.
const imagenes = imagenesDeCompartir();

export const metadata = {
  metadataBase: new URL(SITIO),
  title,
  description,
  openGraph: {
    title,
    description,
    url: SITIO,
    siteName: "Menú Abierto",
    locale: "es_MX",
    type: "website",
    images: imagenes,
  },
  twitter: {
    card: imagenes.length ? "summary_large_image" : "summary",
    title,
    description,
    images: imagenes,
  },
};

export const viewport = { themeColor: "#1c1917" };

export default function RootLayout({ children }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
