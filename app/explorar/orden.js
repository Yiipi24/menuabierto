"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPCIONES = [
  ["relevancia", "Sugeridos"],
  ["cercanos", "Más cercanos"],
  ["calificacion", "Mejor calificados"],
];

export default function Orden({ valor }) {
  const router = useRouter();
  const params = useSearchParams();

  function cambiar(e) {
    const siguiente = new URLSearchParams(params.toString());
    siguiente.set("orden", e.target.value);
    router.push(`/explorar?${siguiente.toString()}`);
  }

  return (
    <label className="orden">
      <span className="hueso-oculto">Ordenar por</span>
      <select value={valor} onChange={cambiar}>
        {OPCIONES.map(([v, texto]) => (
          <option key={v} value={v}>
            {texto}
          </option>
        ))}
      </select>
    </label>
  );
}
