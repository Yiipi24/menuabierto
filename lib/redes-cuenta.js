// Las redes que un comensal puede vincular a su cuenta.
//
// Vincular aquí quiere decir una cosa concreta y comprobable: que esa red
// queda como una forma más de entrar a Menú Abierto, guardada por Supabase
// Auth como una identidad de la misma cuenta. No da permiso para publicar en
// nombre de nadie ni lee nada del perfil de la red, y por eso no depende de
// ninguna revisión de aplicación: basta con activar el proveedor en el panel
// de Supabase.
//
// Instagram y TikTok no aparecen porque Supabase Auth no los ofrece como
// proveedor; para el comensal no hay forma honesta de "conectarlos" hoy.
export const REDES_CUENTA = [
  {
    slug: "facebook",
    // El identificador del proveedor en Supabase, que no siempre se llama como
    // la red: X sigue siendo "twitter" para la API.
    proveedor: "facebook",
    nombre: "Facebook",
    pista: "Entra con tu cuenta de Facebook.",
  },
  {
    slug: "google",
    proveedor: "google",
    nombre: "Google",
    pista: "Entra con tu cuenta de Google.",
  },
  {
    slug: "x",
    proveedor: "twitter",
    nombre: "X",
    pista: "Entra con tu cuenta de X.",
  },
];

export function redDeProveedor(proveedor) {
  return REDES_CUENTA.find((r) => r.proveedor === proveedor) ?? null;
}

// Supabase contesta con este texto cuando el proveedor existe pero nadie lo ha
// encendido en el proyecto. Se traduce a algo que se pueda accionar en vez de
// dejar el inglés de la API en la pantalla.
export function esProveedorApagado(mensaje) {
  return /not enabled|unsupported provider|provider is not enabled/i.test(String(mensaje ?? ""));
}
