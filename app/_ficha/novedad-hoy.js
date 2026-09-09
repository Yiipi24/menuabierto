"use client";

import { useState } from "react";
import Publicaciones, { Publicacion } from "../_social/publicaciones";

// "Hoy en <restaurante>": la última publicación, como vista previa.
//
// Es la misma pieza que el feed —con su corazón, sus comentarios y su
// compartir—, solo que recortada: el texto en tres líneas y el campo de
// comentario escondido hasta que alguien pide ver la publicación completa.
// El resto de las publicaciones se despliega debajo a petición, sin
// desplegarlas todas de entrada: esto es una tarjeta, no un muro.
export default function NovedadHoy({ publicaciones, hayMas, restauranteId, nombre, slug, volverA }) {
  const [completa, setCompleta] = useState(false);
  const [todas, setTodas] = useState(false);

  if (!publicaciones.length) return null;
  const [primera, ...resto] = publicaciones;

  return (
    <section className="fx-novedad" id="novedades" aria-labelledby="fx-novedad-titulo">
      <h2 id="fx-novedad-titulo" className="fx-novedad-titulo">
        Hoy en {nombre}
      </h2>
      <Publicacion
        publicacion={primera}
        nombre={nombre}
        slug={null}
        slugCompartir={slug}
        volverA={volverA}
        compacta={!completa}
        alExpandir={() => setCompleta(true)}
      />

      {resto.length || hayMas ? (
        todas ? (
          <div className="fx-novedad-resto">
            <Publicaciones
              publicaciones={resto}
              restauranteId={restauranteId}
              nombre={nombre}
              slug={slug}
              volverA={volverA}
              hayMas={hayMas}
            />
          </div>
        ) : (
          <button type="button" className="btn-linea fx-novedad-mas" onClick={() => setTodas(true)}>
            Ver más novedades
          </button>
        )
      ) : null}
    </section>
  );
}
