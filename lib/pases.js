// Reseñas verificadas por escaneo: lo que no habla con la base.
//
// El QR de la mesa deja un pase de visita de una semana; una reseña escrita
// con él queda marcada como verificada. Aquí está cómo se leen y se ordenan
// en la ficha: las verificadas primero si se pide, su promedio aparte, y las
// demás siempre visibles. No se bloquea ninguna.

export const DIAS_DE_PASE = 7;

export function esVerificada(resena) {
  return Boolean(resena?.verified_at);
}

// El promedio de un conjunto, a un decimal, o null si está vacío.
export function promedioDe(resenas) {
  const lista = (resenas ?? []).filter((r) => Number.isFinite(Number(r?.rating)));
  if (!lista.length) return null;
  const suma = lista.reduce((a, r) => a + Number(r.rating), 0);
  return Math.round((suma / lista.length) * 10) / 10;
}

export function resumenVerificadas(resenas) {
  const verificadas = (resenas ?? []).filter(esVerificada);
  return {
    total: (resenas ?? []).length,
    verificadas: verificadas.length,
    promedioVerificadas: promedioDe(verificadas),
    promedioTodas: promedioDe(resenas),
  };
}

/**
 * La lista como se pinta: filtrada a verificadas si se pide, y ordenada por
 * fecha o con las verificadas primero. La fecha de siempre es el orden por
 * defecto: la marca distingue, no manda.
 */
export function ordenarResenas(resenas, { soloVerificadas = false, verificadasPrimero = false } = {}) {
  let lista = [...(resenas ?? [])];
  if (soloVerificadas) lista = lista.filter(esVerificada);
  lista.sort((a, b) => {
    if (verificadasPrimero) {
      const va = esVerificada(a) ? 1 : 0;
      const vb = esVerificada(b) ? 1 : 0;
      if (va !== vb) return vb - va;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return lista;
}
