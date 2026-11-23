// El almacenamiento de Supabase es de donde sale el PDF de una carta de
// archivo, que la ficha enseña con <object>: la política de contenido tiene que
// dejarlo. Sin la variable al construir, cualquier proyecto de Supabase.
function origenDelAlmacenamiento() {
  try {
    return new URL(process.env.SUPABASE_URL).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

// Las cabeceras de seguridad de todo el sitio (criterio 17 del tablero, #83).
// Son las que no rompen nada de lo que el sitio hace:
// - nadie más puede meter el sitio en un iframe (clickjacking);
// - el navegador no adivina tipos de archivo;
// - a otros sitios solo les llega el dominio de donde viene la visita;
// - cámara, micrófono y ubicación solo para el propio sitio (las historias, el
//   "cerca de mí" y el punto del local), y nada más para nadie.
// La política de contenido no restringe scripts: Next mete scripts en línea y
// cerrarlos pide nonces en cada respuesta, que es otro cambio.
const CABECERAS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      `object-src 'self' ${origenDelAlmacenamiento()}`,
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  experimental: {
    // Las acciones de servidor aceptan 1 MB por defecto, y aquí se suben fotos
    // de hasta 5 MB y menús en PDF de hasta 10 MB. Pasado el límite, Next
    // rechaza la petición antes de llegar a nuestra validación: la acción
    // revienta, el error sube al límite de error y la página se reemplaza,
    // borrando todo lo que la persona llevaba escrito. El tope va por encima
    // del archivo más grande que aceptamos, con holgura para el resto del form.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: CABECERAS }];
  },
  // La búsqueda vive en la portada desde hace tiempo; /explorar se queda para
  // no romper los enlaces que ya se compartieron. Va aquí y no en una página
  // con `redirect()`: aquella respondía 307 y, con él, el cascarón de la
  // portada (once kilobytes con su mismo título). Aquí es un 308 sin cuerpo,
  // permanente, y Next pasa la query tal cual (`?q=tacos&precio=2`).
  async redirects() {
    return [{ source: "/explorar", destination: "/", permanent: true }];
  },
};
