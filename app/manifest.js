// El manifest de la aplicación. Next lo sirve en /manifest.webmanifest y lo
// enlaza desde el layout. Es lo que permite "Agregar a pantalla de inicio" en
// Android y en iOS, y lo que hace que el sitio abra sin la barra del
// navegador una vez instalado.
export default function manifest() {
  return {
    name: "Menú Abierto",
    short_name: "Menú Abierto",
    description: "Encuentra dónde comer: menús, precios y horarios de restaurantes cerca de ti.",
    lang: "es-MX",
    start_url: "/?fuente=app",
    scope: "/",
    display: "standalone",
    background_color: "#fdfcfa",
    theme_color: "#1c1917",
    orientation: "portrait",
    categories: ["food", "lifestyle"],
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/iconos/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novedades", url: "/novedades", description: "Lo que publican los que sigues" },
      { name: "Avisos", url: "/avisos" },
    ],
  };
}
