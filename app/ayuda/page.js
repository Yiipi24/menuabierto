import Link from "next/link";
import Nav from "../nav";
import DatosEstructurados from "../_ficha/datos-estructurados";
import ContactoDeSoporte from "./contacto";
import { jsonLdPreguntas, preguntasFrecuentes } from "../../lib/soporte";
import { urlDelSitio } from "../../lib/sitio";

export const metadata = {
  title: "Ayuda y preguntas frecuentes — Menú Abierto",
  description:
    "Cuánto cuesta publicar tu restaurante, cómo cargar tu carta desde una foto, cómo funciona el QR, los pedidos por WhatsApp y las reseñas verificadas. Y cómo escribirnos.",
  alternates: { canonical: "/ayuda" },
};

// La ayuda, a la vista sin cuenta (criterio 6 del tablero, #83): por dónde
// escribirnos y lo que más se pregunta. Las respuestas salen de
// `lib/soporte.js`, que lee los precios y los cupos de donde se cobran.
//
// No es un acordeón a propósito: son respuestas cortas, y abiertas se buscan
// con Ctrl+F, se enlazan con su ancla (/ayuda#qr) y se leen sin tocar nada.
export default function Ayuda() {
  const grupos = preguntasFrecuentes();

  return (
    <>
      <Nav />
      <main className="wrap panel-main ayuda">
        <DatosEstructurados datos={jsonLdPreguntas(grupos, urlDelSitio("/ayuda"))} />

        <header className="ayuda-encabezado">
          <h1>Ayuda y preguntas frecuentes</h1>
          <p className="panel-lead">
            Lo que más nos preguntan dueños y comensales. Si tu duda no está aquí, escríbenos.
          </p>
          <ContactoDeSoporte />
          <nav className="ayuda-indice" aria-label="Temas">
            {grupos.map((g) => (
              <a key={g.id} href={`#${g.id}`}>
                {g.titulo}
              </a>
            ))}
          </nav>
        </header>

        {grupos.map((g) => (
          <section key={g.id} id={g.id} className="ayuda-grupo" aria-labelledby={`${g.id}-titulo`}>
            <h2 id={`${g.id}-titulo`}>{g.titulo}</h2>
            {g.preguntas.map((p) => (
              <article key={p.id} id={p.id} className="ayuda-pregunta">
                <h3>{p.pregunta}</h3>
                {p.respuesta.map((parrafo) => (
                  <p key={parrafo}>{parrafo}</p>
                ))}
                {p.enlaces?.length ? (
                  <p className="ayuda-enlaces">
                    {p.enlaces.map((e) => (
                      <Link key={e.href} href={e.href}>
                        {e.texto}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </article>
            ))}
          </section>
        ))}

        <section className="ayuda-final" aria-labelledby="ayuda-final-titulo">
          <h2 id="ayuda-final-titulo">¿No encontraste tu respuesta?</h2>
          <p>Escríbenos y dinos qué necesitas. Si es de tu restaurante, incluye su nombre.</p>
          <ContactoDeSoporte />
        </section>
      </main>
    </>
  );
}
