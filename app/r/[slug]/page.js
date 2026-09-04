import { notFound, permanentRedirect } from "next/navigation";
import { conMarca, destinoViejo } from "./viejo";

export const dynamic = "force-dynamic";

// /r/jc-smoke-house-j5e24 era la dirección de una ficha hasta que las URLs se
// estandarizaron. Los QR impresos, los vinilos pegados en la mesa y los
// enlaces que la gente ya compartió siguen apuntando aquí y no se pueden
// reimprimir: esta ruta existe solo para mandarlos a la dirección nueva.
export default async function FichaVieja({ params, searchParams }) {
  const { slug } = await params;
  const destino = await destinoViejo(slug);
  if (!destino) notFound();
  permanentRedirect(conMarca(destino.ficha, await searchParams));
}
