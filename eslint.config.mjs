import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

// Lo que revisa el lint es lo que rompe en producción: hooks mal usados, un
// <img> donde debería ir el componente de Next, un import que no existe. El
// estilo no se discute aquí.
export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "node_modules/**", "playwright-report/**", "test-results/**"]),
  {
    rules: {
      // La ficha enseña fotos que suben los dueños desde Supabase Storage; el
      // <img> a secas es una decisión, no un descuido.
      "@next/next/no-img-element": "off",
      // Regla del compilador de React: recomienda derivar en vez de sincronizar
      // estado en un efecto. Aquí se usa para leer localStorage y el reloj al
      // montar, que sí es un efecto. Se avisa, no se rompe el build.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
