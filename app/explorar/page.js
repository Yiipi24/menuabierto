import { redirect } from "next/navigation";

// La búsqueda vive ahora en la portada. Esta ruta se queda como redirección
// para no romper los enlaces que ya se compartieron, con sus filtros intactos.
export default async function Explorar({ searchParams }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(sp)) {
    if (typeof valor === "string" && valor !== "") params.set(clave, valor);
  }
  const cadena = params.toString();
  redirect(cadena ? `/?${cadena}` : "/");
}
