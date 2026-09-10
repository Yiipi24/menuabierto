import { test } from "node:test";
import assert from "node:assert/strict";
import { dominioDeSitio, dominioDeCorreo, correoDemuestraElSitio } from "../../lib/reclamos.js";

test("el dominio del sitio se saca con o sin esquema y sin www", () => {
  assert.equal(dominioDeSitio("https://www.tacoselgordo.mx/menu"), "tacoselgordo.mx");
  assert.equal(dominioDeSitio("tacoselgordo.mx"), "tacoselgordo.mx");
  assert.equal(dominioDeSitio("localhost"), null);
  assert.equal(dominioDeSitio(""), null);
  assert.equal(dominioDeCorreo("Pedro@TacosElGordo.mx"), "tacoselgordo.mx");
  assert.equal(dominioDeCorreo("sin-arroba"), null);
});

test("el correo demuestra el sitio solo con dominio propio", () => {
  assert.equal(correoDemuestraElSitio("pedro@tacoselgordo.mx", "https://www.tacoselgordo.mx"), true);
  assert.equal(correoDemuestraElSitio("pedro@reservas.tacoselgordo.mx", "tacoselgordo.mx"), true);
  assert.equal(correoDemuestraElSitio("pedro@gmail.com", "https://gmail.com"), false, "proveedor público");
  assert.equal(correoDemuestraElSitio("pedro@otro.mx", "tacoselgordo.mx"), false);
  assert.equal(correoDemuestraElSitio("pedro@tacoselgordo.mx", null), false);
  assert.equal(correoDemuestraElSitio("pedro@tacoselgordo.mx.evil.com", "tacoselgordo.mx"), false);
});
