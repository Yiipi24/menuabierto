import { defineConfig } from "@playwright/test";

// Las pruebas de extremo a extremo corren contra el sitio construido, no
// contra `next dev`: lo que se prueba es lo que se despliega. Necesitan la
// base real —SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY— porque las fichas que
// visitan son las publicadas; sin ellas no hay nada que mirar y no arrancan.
//
// Con BASE_URL apuntan a un despliegue ya levantado (producción, una vista
// previa) en vez de construir uno.
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, locale: "es-MX" },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
