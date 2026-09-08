"use client";

import { useEffect, useRef, useState } from "react";
import { medir } from "../medir";
import { textoDelDescuento, textoDeVigencia } from "../../lib/cupones";
import { IconoTijeras } from "./iconos";

// Los cupones del restaurante, en la ficha.
//
// Cada uno se cuenta dos veces desde aquí: al verlo y al llevarse el código.
// La primera se manda una sola vez por cupón cuando la tarjeta entra en
// pantalla —contar como "vista" algo que se quedó ocho pantallas más abajo
// inflaría el denominador de la conversión y haría parecer malas a todas las
// promociones—; la segunda, al tocar el código.
//
// La tercera cifra, el canje, no ocurre aquí: pasa en la caja y la registra el
// dueño en su panel.

function Codigo({ slug, cupon }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    medir(slug, "coupon_copy", null, cupon.id);
    try {
      await navigator.clipboard.writeText(cupon.code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Sin portapapeles —Safari sin gesto, un navegador viejo— el código
      // sigue a la vista para copiarlo a mano. El evento ya contó: la
      // intención es la misma.
    }
  }

  return (
    <button type="button" className="cupon-codigo" onClick={copiar}>
      <span className="cupon-codigo-texto">{cupon.code}</span>
      <span className="cupon-codigo-accion">{copiado ? "¡Copiado!" : "Copiar"}</span>
    </button>
  );
}

function Cupon({ slug, cupon }) {
  const caja = useRef(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;

    // Sin IntersectionObserver —o si algo falla— se cuenta la vista de una
    // vez: mejor un denominador un poco alto que ninguno.
    if (typeof IntersectionObserver === "undefined") {
      medir(slug, "coupon_view", null, cupon.id);
      return undefined;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          medir(slug, "coupon_view", null, cupon.id);
          observador.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [slug, cupon.id]);

  return (
    <article className="cupon" ref={caja}>
      <div className="cupon-cuerpo">
        <p className="cupon-descuento">{textoDelDescuento(cupon)}</p>
        <h3 className="cupon-titulo">{cupon.title}</h3>
        {cupon.description ? <p className="cupon-texto">{cupon.description}</p> : null}
        <p className="cupon-vigencia">{textoDeVigencia(cupon)}</p>
        {cupon.terms ? <p className="cupon-condiciones">{cupon.terms}</p> : null}
      </div>

      <div className="cupon-lado">
        <Codigo slug={slug} cupon={cupon} />
        <p className="cupon-instruccion">Dilo en la caja</p>
      </div>
    </article>
  );
}

export default function Cupones({ slug, cupones }) {
  if (!cupones?.length) return null;

  return (
    <section className="ficha-menu-cta ficha-cupones">
      <div className="ficha-menu-texto">
        <span className="ficha-menu-icono" aria-hidden="true">
          <IconoTijeras ancho={26} />
        </span>
        <div className="ficha-menu-titulo">
          <h2>{cupones.length > 1 ? "Promociones para ti" : "Promoción para ti"}</h2>
          <span>Enseña el código en la caja. Solo aquí, solo mientras dure.</span>
        </div>
      </div>

      <div className="cupones">
        {cupones.map((c) => (
          <Cupon key={c.id} slug={slug} cupon={c} />
        ))}
      </div>
    </section>
  );
}
