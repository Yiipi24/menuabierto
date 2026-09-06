import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "../../../lib/supabase";
import { qrCodigoValido, rutaFicha } from "../../../lib/slug";

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

  const supabase = supabaseServer();
  // La traducción va por una función de la base y no por un select: quien
  // escanea no tiene sesión y la RLS solo deja ver fichas publicadas, así que
  // el dueño no podría probar su propio código antes de publicar.
  const { data, error } = await supabase.rpc("restaurante_por_qr", { codigo: limpio });
  if (error) {
    console.error("qr", error.message);
    notFound();
  }

  const ficha = Array.isArray(data) ? data[0] : data;
  if (!ficha?.slug) notFound();

  // `src=qr` es lo único que separa en el tablero un escaneo en la mesa de una
  // visita cualquiera. Viaja en la redirección porque el QR ya no lo lleva: en
  // el código impreso cabe menos si no arrastra una query.
  redirect(`${rutaFicha(ficha.slug)}?src=qr`);
}
