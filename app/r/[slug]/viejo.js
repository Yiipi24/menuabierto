import { supabaseServer } from "../../../lib/supabase";
import { rutaFicha, rutaMenu } from "../../../lib/slug";

/**
 * Traduce un slug del formato viejo a la dirección actual de la ficha. Se
 * busca por `legacy_slug` y también por `slug`, porque un enlace de la época
 * de /r/ puede traer cualquiera de los dos: `legacy_slug` guarda el que se
 * usaba antes de la migración, y hay fichas creadas después que nunca lo
 * tuvieron.
 *
 * Devuelve null si no hay ficha publicada con ese slug, y quien llama contesta
 * un 404: igual que antes, la redirección no revela borradores ajenos.
 */
export async function destinoViejo(slug) {
  const buscado = String(slug ?? "");
  // Los slugs viejos eran letras, números y guiones. Cualquier otra cosa se
  // rechaza aquí: una coma o un paréntesis en el valor no buscaría nada, se
  // metería dentro de la gramática del filtro `or` de PostgREST.
  if (!/^[a-z0-9-]{1,80}$/.test(buscado)) return null;

  const supabase = supabaseServer();
  const { data } = await supabase
    .from("restaurants")
    .select("slug")
    .or(`legacy_slug.eq.${buscado},slug.eq.${buscado}`)
    .maybeSingle();

  if (!data?.slug) return null;
  return { ficha: rutaFicha(data.slug), menu: rutaMenu(data.slug) };
}

/**
 * La marca de origen viaja con la redirección. El QR impreso apunta a
 * `?src=qr` y es lo único que distingue un escaneo en la mesa de una visita
 * cualquiera: si la redirección la perdiera, todo el tráfico de los QR ya
 * impresos empezaría a contarse como "directo" en el panel del dueño.
 */
export function conMarca(destino, searchParams) {
  const src = String(searchParams?.src ?? searchParams?.utm_source ?? "");
  if (!/^[a-z0-9_-]{1,32}$/i.test(src)) return destino;
  return `${destino}?src=${encodeURIComponent(src)}`;
}
