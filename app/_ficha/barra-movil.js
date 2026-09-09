import Link from "next/link";
import { BotonPedirWhatsapp } from "./pedido";
import { mensajeDeContacto } from "../../lib/whatsapp";
import { urlDelSitio } from "../../lib/sitio";
import { IconoCubiertos } from "./iconos";

// La barra de abajo en un teléfono: pedir y ver el menú, siempre a la mano.
// Solo existe en pantallas chicas —el CSS la esconde en las demás— y la
// página deja sitio debajo para que no tape el pie.
export default function BarraMovil({ slug, nombre, pedidos, hrefMenu, volverA }) {
  if (!pedidos && !hrefMenu) return null;
  return (
    <div className="barra-movil" role="region" aria-label="Acciones principales">
      {pedidos ? (
        <BotonPedirWhatsapp
          telefono={pedidos.telefono}
          mensaje={mensajeDeContacto(nombre, urlDelSitio(volverA))}
          slug={slug}
          clase="btn btn-whatsapp barra-movil-pedir"
        />
      ) : null}
      {hrefMenu ? (
        <Link className={pedidos ? "btn-linea barra-movil-menu" : "btn barra-movil-menu"} href={hrefMenu}>
          <IconoCubiertos ancho={18} />
          Ver menú
        </Link>
      ) : null}
    </div>
  );
}
