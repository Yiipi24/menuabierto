import Listado, { metadataListado } from "../../listado";

// /comida/tacos/coyoacan: la búsqueda que la gente escribe en Google, con su
// propia dirección. Solo existe donde hay al menos un restaurante de esa
// cocina en esa zona; lo demás es un 404.

export async function generateMetadata({ params }) {
  const { cocina, zona } = await params;
  return metadataListado(cocina, zona);
}

export default async function ZonaPagina({ params }) {
  const { cocina, zona } = await params;
  return <Listado cocina={cocina} zona={zona} />;
}
