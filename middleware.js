import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Refresca el token antes de que lo lean las páginas. Sin esto, la sesión de
// un dueño que deja el panel abierto caduca a media edición.
export async function middleware(request) {
  // Si Supabase cae en su Site URL en vez del destino que pidio la app, el
  // codigo aterriza en la raiz en lugar de /auth/callback. En vez de perder
  // el inicio de sesion, lo reencaminamos nosotros.
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname === "/") {
    const destino = new URL("/auth/callback", request.url);
    destino.searchParams.set("code", code);
    return NextResponse.redirect(destino);
  }

  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        for (const { name, value } of items) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/", "/panel/:path*", "/entrar", "/reclamar"],
};
