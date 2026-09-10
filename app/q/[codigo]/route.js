import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { supabaseServer, supabaseSession } from "../../../lib/supabase";
import { TAG_RUTAS, VIGENCIA_RUTAS } from "../../../lib/cache";
import { qrCodigoValido, rutaFicha } from "../../../lib/slug";
import { COOKIE_VISITANTE, DIAS_COOKIE } from "../../../lib/eventos";

// Aquí aterriza quien escanea el QR de la mesa. Es lo único que hay detrás
// del código impreso: traducirlo a la dirección de la ficha, dejar el pase de
// visita, y mandar al comensal allá.
//
// Era una página y ahora es una ruta, por el pase: para asociarlo hace falta
// la cookie del visitante, y ponerla cuando no existe solo se puede desde una
// respuesta, no desde un componente. Todo lo demás es igual que antes.
//
// La redirección es temporal (307) a propósito. Una permanente se le queda
// guardada al navegador y al lector de QR, y entonces el día que la ficha
// cambie de dirección el aparato seguiría yendo a la vieja sin volver a
// preguntar, que es justo lo que este rodeo evita.
export const dynamic = "force-dynamic";

function slugDe(codigo) {
  // El código impreso es permanente y el slug al que lleva casi nunca cambia,
  // así que la traducción se guarda con la etiqueta de las rutas: el panel la
  // tira en cuanto una ficha cambia de dirección o deja de publicarse, y
  // mientras tanto un mediodía entero de escaneos no toca la base.
  return unstable_cache(
    async () => {
      const supabase = supabaseServer();
      const { data, error } = await supabase.rpc("restaurante_por_qr", { codigo });
      if (error) {
        console.error("qr", error.message);
        return null;
      }
      const ficha = Array.isArray(data) ? data[0] : data;
      return ficha?.slug ?? null;
    },
    ["qr", codigo],
    { tags: [TAG_RUTAS], revalidate: VIGENCIA_RUTAS },
  )();
}

export async function GET(request, { params }) {
  const { codigo } = await params;
  const limpio = String(codigo ?? "").trim().toLowerCase();
  if (!qrCodigoValido(limpio)) return new Response(null, { status: 404 });

  const slug = await slugDe(limpio);
  if (!slug) return new Response(null, { status: 404 });

  // El visitante: la misma cookie anónima que identifica los eventos. Si no
  // la trae, se le pone aquí; el middleware no pasa por /q.
  const galletas = await cookies();
  let visitante = galletas.get(COOKIE_VISITANTE)?.value;
  const nueva = !visitante || visitante.length < 8 || visitante.length > 64;
  if (nueva) visitante = crypto.randomUUID();

  // El pase de visita: el escaneo es la única prueba de que alguien estuvo en
  // el local, y es lo que vuelve verificada la reseña que escriba después. Va
  // con sesión si la hay —así vale desde otro aparato— y no puede estorbar a
  // la redirección: sin pase, el QR sigue abriendo la ficha.
  try {
    const supabase = await supabaseSession();
    await supabase.rpc("registrar_pase_qr", { p_codigo: limpio, p_visitante: visitante });
  } catch (error) {
    console.error("pase de visita", error?.message);
  }

  // `src=qr` es lo único que separa en el tablero un escaneo en la mesa de una
  // visita cualquiera. Viaja en la redirección porque el QR ya no lo lleva.
  const respuesta = NextResponse.redirect(new URL(`${rutaFicha(slug)}?src=qr`, request.url), 307);
  if (nueva) {
    respuesta.cookies.set(COOKIE_VISITANTE, visitante, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DIAS_COOKIE * 24 * 60 * 60,
    });
  }
  return respuesta;
}
