"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { marcarAvisosLeidos } from "../_social/actions";
import { hace } from "../../lib/social";
import { textoDeAviso } from "../../lib/resenas";
import { IconoCampana, IconoDestello } from "../_social/iconos";

// La bandeja. Los avisos se marcan como leídos al abrirla —estar aquí es
// haberlos visto— pero se siguen enseñando: una bandeja que se vacía sola al
// entrar deja a la persona sin saber qué había.
export default function ListaAvisos({ avisos }) {
  const [sinLeer, setSinLeer] = useState(() => avisos.filter((a) => !a.read_at).length);
  const [, empezar] = useTransition();

  useEffect(() => {
    if (!sinLeer) return;
    empezar(async () => {
      const r = await marcarAvisosLeidos();
      if (r.ok) setSinLeer(0);
    });
    // Una vez, al llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!avisos.length) {
    return (
      <div className="vacio">
        <h2>No tienes avisos</h2>
        <p>
          Enciende la campana en la ficha de un restaurante y te avisamos aquí
          cuando publique una historia. Si tienes restaurante, aquí llegan sus
          reseñas nuevas; si escribes reseñas, las respuestas del dueño.
        </p>
        <Link className="btn" href="/novedades">
          Ver tus novedades
        </Link>
      </div>
    );
  }

  return (
    <ul className="avisos">
      {avisos.map((a) => {
        // Una reseña nueva para el dueño, o la respuesta del dueño para quien
        // escribió: dicen quién, cuántas estrellas y un pedazo del texto.
        const resena = textoDeAviso(a);
        if (resena) {
          return (
            <li key={a.id} className={a.read_at ? "aviso" : "aviso sin-leer"}>
              <Link href={resena.href}>
                <span className="aviso-media aviso-media-estrella" aria-hidden="true">
                  ★
                </span>
                <span className="aviso-texto">
                  <strong>{resena.titulo}</strong>
                  {resena.detalle ? <em> “{resena.detalle}”</em> : null}
                </span>
                <span className="aviso-fecha">{hace(a.created_at)}</span>
                {!a.read_at ? (
                  <span className="aviso-punto" aria-label="Sin leer">
                    <IconoCampana ancho={14} relleno />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        }
        return (
        <li key={a.id} className={a.read_at ? "aviso" : "aviso sin-leer"}>
          <Link href={`/${a.restaurant_slug}`}>
            <span className="aviso-media" aria-hidden="true">
              {a.url ? <img src={a.url} alt="" loading="lazy" /> : <IconoDestello ancho={20} />}
            </span>
            <span className="aviso-texto">
              <strong>{a.restaurant_name}</strong> publicó una historia.
              {/* Una historia caducada ya no se puede abrir, y el aviso tiene
                  que decirlo en vez de llevar a una ficha donde no está. */}
              {a.vigente ? null : <em> Ya no está disponible.</em>}
            </span>
            <span className="aviso-fecha">{hace(a.created_at)}</span>
            {!a.read_at ? (
              <span className="aviso-punto" aria-label="Sin leer">
                <IconoCampana ancho={14} relleno />
              </span>
            ) : null}
          </Link>
        </li>
        );
      })}
    </ul>
  );
}
