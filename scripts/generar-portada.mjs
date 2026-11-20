// Los anchos de la foto del encabezado: `public/portada/hero-<ancho>.webp`.
// La portada la sirve en srcset y un celular baja la de 1280 en vez de la
// original de 1920 (#82). Se corre una vez cada que cambia la foto:
//
//     node scripts/generar-portada.mjs
//
// Usa sharp, que llega con Next. La foto va lavada con un velo crema, así que
// aguanta una calidad baja sin que se note.
import sharp from "sharp";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const CARPETA = join(process.cwd(), "public", "portada");
const ANCHOS = [640, 960, 1280, 1920];
const CALIDAD = 60;

const original = ["hero.avif", "hero.webp", "hero.jpg", "hero.jpeg", "hero.png"]
  .map((n) => join(CARPETA, n))
  .find((ruta) => existsSync(ruta));

if (!original) {
  console.log("No hay public/portada/hero.*: nada que generar.");
  process.exit(0);
}

// Las variantes viejas se van: si la foto cambió de tamaño, un ancho que ya
// no toca no puede quedarse sirviendo la foto anterior.
for (const archivo of readdirSync(CARPETA)) {
  if (/^hero-\d+\.webp$/.test(archivo)) unlinkSync(join(CARPETA, archivo));
}

const { width } = await sharp(original).metadata();
for (const ancho of ANCHOS.filter((a) => a <= width)) {
  const destino = join(CARPETA, `hero-${ancho}.webp`);
  const info = await sharp(original)
    .resize({ width: ancho })
    .webp({ quality: CALIDAD })
    .toFile(destino);
  console.log(`hero-${ancho}.webp · ${Math.round(info.size / 1024)} KB`);
}
