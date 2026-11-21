import Link from "next/link";
import { quienResponde } from "../lib/legal";

// El aviso de privacidad simplificado: la LFPDPPP pide ponerlo donde se recaba
// el dato, con quién responde, para qué se usa y dónde leer el integral. Cada
// formulario dice su finalidad en `para`; `terminos` agrega la aceptación de
// los términos donde se crea una cuenta. Sin hooks, así lo usan igual los
// formularios de cliente y los de servidor.
export default function AvisoCorto({ para, terminos = false }) {
  return (
    <p className="aviso-corto">
      {terminos ? (
        <>
          Al continuar aceptas los <Link href="/terminos">Términos y condiciones</Link>.{" "}
        </>
      ) : null}
      {quienResponde()} usará estos datos {para}. Consulta el{" "}
      <Link href="/privacidad">Aviso de privacidad</Link>.
    </p>
  );
}
