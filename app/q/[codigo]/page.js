import { unstable_cache } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "../../../lib/supabase";
import { TAG_RUTAS, VIGENCIA_RUTAS } from "../../../lib/cache";
import { qrCodigoValido, rutaFicha } from "../../../lib/slug";

// Esta sí se queda dinámica, y a propósito. Lo que devuelve no es una página
// sino una redirección temporal, y de eso depende que el vinil de la mesa
// siga sirviendo el día que la ficha cambie de dirección: convertirla en una
// página guardada sería devolverle al lector de QR justo el destino fijo que
// el rodeo existe para no darle. Lo que sí se guarda es la traducción de
// abajo, que es lo que costaba una consulta por escaneo.
export const dynamic = "force-dynamic";

// No se indexa: la dirección buena de un restaurante es su ficha, y dos URLs
// para lo mismo se reparten el posicionamiento.
export const metadata = { robots: { index: false, follow: false } };

// Aquí aterriza quien escanea el QR de la mesa. Es lo único que hay detrás del
// código impreso: traducirlo a la dirección de la ficha y mandar al comensal
// allá, que es la página móvil del restaurante con sus cartas, sus horarios y
// cómo llegar.
//
// Existe esta ruta en vez de imprimir la ficha directamente porque el código
// es permanente y el slug no tiene por qué serlo: el vinil se pega una vez y
// tiene que seguir sirviendo aunque la ficha cambie de dirección.
//
// La redirección es temporal (307) a propósito. Una permanente se le queda
// guardada al navegador y al lector de QR, y entonces el día que la ficha
// cambie de dirección el aparato seguiría yendo a la vieja sin volver a
// preguntar, que es justo lo que este rodeo evita.
export default async function EscaneoQr({ params }) {
  const { codigo } = await params;
  const limpio = String(codigo ?? "").trim().toLowerCase();
  if (!qrCodigoValido(limpio)) notFound();

  // El código impreso es permanente y el slug al que lleva casi nunca cambia,
  // así que la traducción se guarda con la etiqueta de las rutas: el panel la
  // tira en cuanto una ficha cambia de dirección o deja de publicarse, y
  // mientras tanto un mediodía entero de escaneos no toca la base.
  const slug = await unstable_cache(
    async () => {
      const supabase = supabaseServer();
      // La traducción va por una función de la base y no por un select: quien
      // escanea no tiene sesión y la RLS solo deja ver fichas publicadas, así
      // que el dueño no podría probar su propio código antes de publicar.
      const { data, error } = await supabase.rpc("restaurante_por_qr", { codigo: limpio });
      if (error) {
        console.error("qr", error.message);
        return null;
      }

      const ficha = Array.isArray(data) ? data[0] : data;
      return ficha?.slug ?? null;
    },
    ["qr", limpio],
    { tags: [TAG_RUTAS], revalidate: VIGENCIA_RUTAS },
  )();

  if (!slug) notFound();

  // `src=qr` es lo único que separa en el tablero un escaneo en la mesa de una
  // visita cualquiera. Viaja en la redirección porque el QR ya no lo lleva: en
  // el código impreso cabe menos si no arrastra una query.
  redirect(`${rutaFicha(slug)}?src=qr`);
}
