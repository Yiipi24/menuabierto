/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  experimental: {
    // Las acciones de servidor aceptan 1 MB por defecto, y aquí se suben fotos
    // de hasta 5 MB y menús en PDF de hasta 10 MB. Pasado el límite, Next
    // rechaza la petición antes de llegar a nuestra validación: la acción
    // revienta, el error sube al límite de error y la página se reemplaza,
    // borrando todo lo que la persona llevaba escrito. El tope va por encima
    // del archivo más grande que aceptamos, con holgura para el resto del form.
    serverActions: { bodySizeLimit: "12mb" },
  },
};
