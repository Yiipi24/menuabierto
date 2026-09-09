// Genera los PNG del manifest a partir de app/icon.svg con el Chromium de
// Playwright: no hay sharp ni ImageMagick en el entorno.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("app/icon.svg", "utf8");
// En el entorno de desarrollo el Chromium ya está instalado en otra ruta
// (PLAYWRIGHT_BROWSERS_PATH) y no coincide con la versión que Playwright
// pide; se le indica el ejecutable si existe.
import { existsSync } from "node:fs";
const candidato = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const browser = await chromium.launch(existsSync(candidato) ? { executablePath: candidato } : {});
const page = await browser.newPage();

async function render(tamano, { fondo = null, margen = 0 } = {}) {
  await page.setViewportSize({ width: tamano, height: tamano });
  const dentro = tamano - margen * 2;
  await page.setContent(`<html><body style="margin:0;background:${fondo ?? "transparent"};width:${tamano}px;height:${tamano}px;display:grid;place-items:center">
    <div style="width:${dentro}px;height:${dentro}px">${svg.replace("<svg ", `<svg width="${dentro}" height="${dentro}" `)}</div></body></html>`);
  return page.screenshot({ omitBackground: !fondo, type: "png" });
}

writeFileSync("public/iconos/icono-192.png", await render(192));
writeFileSync("public/iconos/icono-512.png", await render(512));
// Maskable: el sistema recorta un círculo, así que el dibujo va con margen
// sobre fondo sólido para que no se corte el pin.
writeFileSync("public/iconos/maskable-512.png", await render(512, { fondo: "#fdfcfa", margen: 80 }));
writeFileSync("public/iconos/apple-touch-icon.png", await render(180, { fondo: "#fdfcfa", margen: 18 }));
writeFileSync("public/iconos/badge-96.png", await render(96));
await browser.close();
console.log("iconos listos");
