import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CORREO_DE_SOPORTE,
  canalesDeSoporte,
  enlaceDeCorreo,
  jsonLdPreguntas,
  preguntasFrecuentes,
  whatsappDeSoporte,
} from "../../lib/soporte.js";
import { MONEDA, PLANES_DE_PAGA, precioConIva, precioDe } from "../../lib/cobro.js";
import { LECTURAS_POR_MES } from "../../lib/extraccion.js";
import { pesos } from "../../lib/precios.js";

const texto = (p) => p.respuesta.join(" ");
const todas = () => preguntasFrecuentes().flatMap((g) => g.preguntas);
const pregunta = (id) => todas().find((p) => p.id === id);

test("sin WhatsApp configurado solo se ofrece el correo", () => {
  const canales = canalesDeSoporte({ whatsapp: null });
  assert.deepEqual(canales, [
    { tipo: "correo", etiqueta: "Correo", texto: CORREO_DE_SOPORTE, href: `mailto:${CORREO_DE_SOPORTE}` },
  ]);
});

test("con WhatsApp, va primero y con el mensaje ya escrito", () => {
  const canales = canalesDeSoporte({ whatsapp: "528112345678", asunto: "Ayuda con mi ficha", mensaje: "Hola, vengo del panel" });
  assert.equal(canales[0].tipo, "whatsapp");
  assert.equal(canales[0].texto, "+52 81 1234 5678");
  assert.equal(canales[0].href, "https://wa.me/528112345678?text=Hola%2C%20vengo%20del%20panel");
  assert.equal(canales[1].href, "mailto:hola@menuabierto.com?subject=Ayuda%20con%20mi%20ficha");
});

test("el WhatsApp de soporte se normaliza, y mal escrito cuenta como ausente", () => {
  assert.equal(whatsappDeSoporte("81 1234 5678"), "528112345678");
  assert.equal(whatsappDeSoporte("+52 1 81 1234 5678"), "528112345678");
  assert.equal(whatsappDeSoporte(""), null);
  assert.equal(whatsappDeSoporte("12"), null);
  assert.equal(whatsappDeSoporte(undefined), null);
});

test("el correo sin asunto no lleva una interrogación colgando", () => {
  assert.equal(enlaceDeCorreo("hola@menuabierto.com", "  "), "mailto:hola@menuabierto.com");
  assert.equal(enlaceDeCorreo(null, "x"), null);
});

test("las preguntas tienen ids únicos y respuestas con texto", () => {
  const grupos = preguntasFrecuentes();
  assert.deepEqual(grupos.map((g) => g.id), ["duenos", "comensales"]);
  const ids = todas().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of todas()) {
    assert.match(p.pregunta, /\?$/, p.id);
    assert.ok(p.respuesta.length > 0 && p.respuesta.every((r) => r.trim().length > 20), p.id);
    for (const e of p.enlaces ?? []) assert.match(e.href, /^\//, p.id);
  }
});

test("los precios de la respuesta son los que se cobran, antes y con IVA", () => {
  const respuesta = texto(pregunta("cuanto-cuesta"));
  for (const slug of PLANES_DE_PAGA) {
    assert.ok(respuesta.includes(pesos(precioDe(slug), MONEDA)), `${slug} sin IVA`);
    assert.ok(respuesta.includes(pesos(precioConIva(slug), MONEDA)), `${slug} con IVA`);
  }
});

test("los cupos de la carta desde una foto son los del plan", () => {
  const respuesta = texto(pregunta("carta-desde-foto"));
  for (const n of Object.values(LECTURAS_POR_MES)) assert.match(respuesta, new RegExp(`\\b${n} en `));
});

test("los datos estructurados dicen lo mismo que la página", () => {
  const grupos = preguntasFrecuentes();
  const ld = jsonLdPreguntas(grupos, "https://menuabierto.com/ayuda");
  assert.equal(ld["@type"], "FAQPage");
  assert.equal(ld.mainEntity.length, todas().length);
  const primera = ld.mainEntity[0];
  assert.equal(primera.name, grupos[0].preguntas[0].pregunta);
  assert.equal(primera.acceptedAnswer.text, texto(grupos[0].preguntas[0]));
});
