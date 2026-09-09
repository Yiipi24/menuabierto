import { reportarError } from "./lib/errores";

// Next llama a esto con cada error no atrapado del servidor: una página que
// reventó, una acción que lanzó, una ruta de la API que no contestó. Es el
// único gancho que ve todos, así que es de donde salen los avisos.
export async function onRequestError(error, peticion, contexto) {
  await reportarError(error, {
    ruta: peticion?.path,
    metodo: peticion?.method,
    tipo: contexto?.routeType,
    digest: error?.digest,
  });
}
