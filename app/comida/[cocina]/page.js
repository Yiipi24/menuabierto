import Listado, { metadataListado } from "../listado";

// /comida/tacos: todos los restaurantes de una cocina, y desde ahí las zonas
// donde los hay. Es la página que enlaza la portada y la que sostiene a las de
// zona: sin ella, /comida/tacos/coyoacan colgaría de la nada.

export async function generateMetadata({ params }) {
  const { cocina } = await params;
  return metadataListado(cocina);
}

export default async function CocinaPagina({ params }) {
  const { cocina } = await params;
  return <Listado cocina={cocina} />;
}
