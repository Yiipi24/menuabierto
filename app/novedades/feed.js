"use client";

import Link from "next/link";
import { useState } from "react";
import { Publicacion } from "../_social/publicaciones";
import Historias from "../_social/historias";
import { alternarSeguir } from "../_social/actions";

// El feed del comensal.
//
// Arriba las historias de los restaurantes que sigue, agrupadas por local
// —cinco círculos del mismo sitio serían cinco veces el mismo nombre—, y debajo
// las publicaciones mezcladas por fecha. Es la misma pieza `Publicacion` que la
// ficha, con la cabecera diciendo de quién es cada una.
export default function Feed({ historias, publicaciones }) {
  const [lista, setLista] = useState(publicaciones);
  const [grupos, setGrupos] = useState(historias);
  const [aviso, setAviso] = useState("");

  async function dejarDeSeguir(publicacion) {
    const id = publicacion.restaurant_id;
    const nombre = publicacion.restaurant_name;

    // Se va todo lo suyo de la pantalla de una vez: dejar de seguir y que sus
    // publicaciones sigan ahí hasta recargar se lee como si el botón no
    // hubiera funcionado.
    const antesLista = lista;
    const antesGrupos = grupos;
    setLista((previas) => previas.filter((p) => p.restaurant_id !== id));
    setGrupos((previos) => previos.filter((g) => g.id !== id));
    setAviso(`Dejaste de seguir a ${nombre}.`);

    const r = await alternarSeguir(id, false);
    if (!r.ok) {
      setLista(antesLista);
      setGrupos(antesGrupos);
      setAviso("No pudimos dejar de seguirlo. Inténtalo otra vez.");
    }
  }

  return (
    <>
      {/* Cada restaurante con historias trae su propia tira: el visor avanza
          dentro de un local y no salta de uno a otro a media historia. */}
      {grupos.length ? (
        <div className="feed-historias">
          {grupos.map((g) => (
            <div key={g.id} className="feed-historias-grupo">
              <Historias
                historias={g.historias}
                nombre={g.nombre}
                titulo={g.nombre}
                volverA="/novedades"
              />
            </div>
          ))}
        </div>
      ) : null}

      {aviso ? (
        <p className="form-msg ok" role="status">
          {aviso}
        </p>
      ) : null}

      {lista.length ? (
        <div className="publicaciones feed-publicaciones">
          {lista.map((p) => (
            <Publicacion
              key={`${p.id}-${p.restaurant_id}`}
              publicacion={p}
              nombre={p.restaurant_name}
              slug={p.restaurant_slug}
              volverA="/novedades"
              alBorrar={dejarDeSeguir}
            />
          ))}
        </div>
      ) : grupos.length ? null : (
        <div className="vacio">
          <h2>Todavía no hay nada nuevo</h2>
          <p>
            Los restaurantes que sigues no han publicado nada. En cuanto lo
            hagan, aparece aquí.
          </p>
          <Link className="btn" href="/">
            Descubrir restaurantes
          </Link>
        </div>
      )}
    </>
  );
}
