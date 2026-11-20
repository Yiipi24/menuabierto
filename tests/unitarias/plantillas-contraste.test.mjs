import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FONDOS_CLAROS,
  FONDO_PIZARRON,
  PALETAS,
  colorLegible,
  contraste,
  variablesDeEstilo,
} from "../../lib/plantillas.js";

test("contraste da los valores de WCAG", () => {
  assert.equal(Math.round(contraste("#000000", "#ffffff")), 21);
  assert.equal(contraste("#777777", "#777777"), 1);
  // El naranja de antes sobre blanco no llegaba a 4.5 (axe lo marcó en 4.23);
  // el de ahora sí.
  assert.ok(contraste("#d94a26", "#ffffff") < 4.5);
  assert.ok(contraste("#bf4121", "#ffffff") >= 4.5);
});

test("colorLegible no toca un color que ya se lee, y oscurece o aclara el que no", () => {
  assert.equal(colorLegible("#9f1239", ["#ffffff"]), "#9f1239");
  const ambarEnPapel = colorLegible("#d6a15f", FONDOS_CLAROS);
  assert.ok(contraste(ambarEnPapel, "#fdfaf5") >= 4.5);
  assert.ok(contraste(ambarEnPapel, "#ffffff") >= 4.5);
  const tintaEnPizarron = colorLegible("#292524", [FONDO_PIZARRON]);
  assert.ok(contraste(tintaEnPizarron, FONDO_PIZARRON) >= 4.5);
});

// Cada paleta, sobre cada fondo donde su acento va como texto. Una paleta
// nueva con un color que no se lee rompe esta prueba, no la carta.
for (const paleta of PALETAS) {
  test(`la paleta ${paleta.slug} se lee como texto en la carta clara y en el pizarrón`, () => {
    const v = variablesDeEstilo({ paleta: paleta.slug });
    for (const fondo of [...FONDOS_CLAROS, paleta.suave]) {
      assert.ok(
        contraste(v["--menu-acento-en-claro"], fondo) >= 4.5,
        `${paleta.slug} sobre ${fondo}: ${contraste(v["--menu-acento-en-claro"], fondo).toFixed(2)}`,
      );
    }
    assert.ok(contraste(v["--menu-acento-en-oscuro"], FONDO_PIZARRON) >= 4.5);
    // La cinta del pizarrón: texto oscuro sobre el acento legible.
    assert.ok(contraste("#17130f", v["--menu-acento-en-oscuro"]) >= 4.5);
    // El acento original se conserva para lo decorativo.
    assert.equal(v["--menu-acento"], paleta.acento);
  });
}
