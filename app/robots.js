import { SITIO, sitioIndexable, urlDelSitio } from "../lib/sitio";

// Las rutas que no son contenido: el panel del dueño, la entrada y el resto
// de lo que pide sesión. Ninguna sirve de nada en un buscador —quien llegue
// acaba en /entrar— y todas cuestan rastreo que se le quita a las fichas.
//
// Se cierran con tres patrones en vez de con el prefijo pelado porque las
// fichas cuelgan de la raíz: `/entrar` a secas también taparía a un
// restaurante llamado "Entrarte", que vive en /entrarte y es justo lo que
// queremos que se indexe. Solo se bloquean la ruta exacta, lo que cuelga de
// ella y lo que trae query.
const PRIVADAS = [
  "/panel",
  "/entrar",
  "/registro",
  "/recuperar",
  "/reclamar",
  "/sin-conexion",
  "/novedades",
  "/avisos",
  "/explorar",
];

export default function robots() {
  // Una vista previa no debe aparecer en los resultados con el sitio entero
  // duplicado. Se cierra completa y sin sitemap: no hay nada que ofrecer.
  if (!sitioIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        // El QR impreso. La página anota el escaneo y reenvía a la ficha, así
        // que un rastreador pasando por aquí infla las métricas del dueño con
        // escaneos que nadie hizo. La ficha ya está en el sitemap.
        "/q/",
        // La portada con filtros. Cada filtro es un enlace a `/?…`, y siete
        // filtros combinables son una cantidad sin fondo de URLs que dicen lo
        // mismo que las páginas de zona (/comida/tacos/coyoacan), que son las
        // que se indexan. Un rastreador que las recorría todas renderizaba la
        // portada unas 110 000 veces al día, cada una con sus consultas: casi
        // todo el consumo del proyecto en Vercel. `/?` tapa solo la portada
        // con query; `/` a secas y las fichas siguen abiertas.
        "/?",
        ...PRIVADAS.flatMap((ruta) => [`${ruta}$`, `${ruta}/`, `${ruta}?`]),
      ],
    },
    sitemap: urlDelSitio("/sitemap.xml"),
    host: SITIO,
  };
}
