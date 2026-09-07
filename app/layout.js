import "./globals.css";
import { SITIO } from "../lib/sitio";

const title = "Menú Abierto — encuentra dónde comer, y haz que te encuentren";
const description =
  "Busca restaurantes por ubicación, tipo de comida, precio y calificación. Si tienes un restaurante, publica tu menú, tus fotos y tus precios, y mantenlos siempre al día.";

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
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport = { themeColor: "#1c1917" };

export default function RootLayout({ children }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
