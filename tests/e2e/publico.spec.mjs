import { test, expect } from "@playwright/test";

// Los caminos que no pueden romperse: buscar, ver una ficha, ver su carta, y
// que el panel no enseñe nada a quien no entró. La ficha se elige del sitemap
// para no depender de que exista un restaurante concreto.

async function primeraFichaPublicada(request) {
  const respuesta = await request.get("/sitemap.xml");
  expect(respuesta.ok()).toBeTruthy();
  const xml = await respuesta.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  // Una ficha es una ruta de uno o dos tramos que no es de /comida ni la raíz.
  return urls.find((r) => /^\/[a-z0-9]+(\/[a-z0-9]+)?$/.test(r) && !r.startsWith("/comida")) ?? null;
}

test("la portada carga y busca", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  const buscador = page.locator('input[name="q"], input[type="search"]').first();
  await expect(buscador).toBeVisible();
  await buscador.fill("tacos");
  await buscador.press("Enter");
  await page.waitForURL(/[?&]q=tacos/);
  await expect(page.locator("main")).toBeVisible();
});

test("una ficha publicada y su carta responden", async ({ page, request }) => {
  const ruta = await primeraFichaPublicada(request);
  test.skip(!ruta, "No hay fichas publicadas en el sitemap.");

  const ficha = await page.goto(ruta);
  expect(ficha.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator('script[type="application/ld+json"]').first()).toHaveCount(1);

  const carta = await page.goto(`${ruta}/menu`);
  expect(carta.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible();
});

test("el panel manda a entrar a quien no tiene sesión", async ({ page }) => {
  await page.goto("/panel");
  await page.waitForURL(/\/entrar/);
  await expect(page.locator("form")).toBeVisible();
});

test("las páginas por cocina existen o dan 404, nunca 500", async ({ request }) => {
  const indice = await request.get("/comida");
  expect(indice.status()).toBe(200);
  const inventada = await request.get("/comida/cocina-que-no-existe/zona-inventada");
  expect(inventada.status()).toBe(404);
});

test("el webhook de cobro rechaza lo que no viene firmado", async ({ request }) => {
  const respuesta = await request.post("/api/cobro/webhook?data.id=1", {
    data: { type: "subscription_preapproval", data: { id: "1" } },
  });
  // 401 sin firma; 503 si el despliegue no tiene el secreto. Nunca 200.
  expect([401, 503]).toContain(respuesta.status());
});
