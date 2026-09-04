import { notFound, permanentRedirect } from "next/navigation";
import { conMarca, destinoViejo } from "../viejo";

export const dynamic = "force-dynamic";

// El QR que ya está impreso apunta a /r/<slug viejo>/menu. Es el enlace que
// más importa conservar: es el único que un comensal escanea sentado a la mesa
// y el que el restaurante no puede corregir sin volver a imprimir.
export default async function MenuViejo({ params, searchParams }) {
  const { slug } = await params;
  const destino = await destinoViejo(slug);
  if (!destino) notFound();
  permanentRedirect(conMarca(destino.menu, await searchParams));
}
