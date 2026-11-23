import { test } from "node:test";
import assert from "node:assert/strict";
import {
  camposDeEnvio,
  cotizarEnvio,
  distanciaLegible,
  leerEnvioDelFormulario,
  minutosLegibles,
  reglasDeEnvio,
  renglonDeEnvio,
  textoDeEnvio,
  zonasValidas,
} from "../../lib/envio.js";

// Un local con tres zonas por radio, mínimo de $150, gratis desde $400 y 20
// minutos para llevar.
const conZonas = reglasDeEnvio({
  delivery_zones: [
    { max_km: 6, fee_cents: 5000, minutes: 50 },
    { max_km: 3, fee_cents: 3000, minutes: 35 },
    { max_km: 9, fee_cents: 7000, minutes: 60 },
  ],
  delivery_min_cents: 15000,
  delivery_free_from_cents: 40000,
  pickup_minutes: 20,
});

const fijo = reglasDeEnvio({ delivery_zones: [{ max_km: null, fee_cents: 4000, minutes: 40 }] });

function formulario(campos) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

test("sin reglas no hay nada que aplicar", () => {
  assert.equal(reglasDeEnvio({}), null);
  assert.equal(reglasDeEnvio({ delivery_zones: [] }), null);
  assert.deepEqual(cotizarEnvio(null, { subtotal: 100, distanciaM: 5000 }).costo, null);
  assert.equal(textoDeEnvio(null), null);
});

test("las zonas se ordenan, se limpian y la de sin distancia cierra la lista", () => {
  assert.deepEqual(
    conZonas.zonas.map((z) => z.km),
    [3, 6, 9],
  );
  assert.equal(conZonas.hastaKm, 9);
  assert.equal(conZonas.conRadio, true);
  // Una zona sin distancia en medio corta lo que sigue; los datos raros se van.
  const zonas = zonasValidas([
    { max_km: 2, fee_cents: 2000 },
    { max_km: null, fee_cents: 6000 },
    { max_km: 80, fee_cents: 9000 },
    { max_km: 4, fee_cents: -1 },
    { max_km: "x", fee_cents: 100 },
  ]);
  assert.deepEqual(zonas, [
    { km: 2, costo: 2000, minutos: null },
    { km: null, costo: 6000, minutos: null },
  ]);
  assert.equal(fijo.conRadio, false);
  assert.equal(fijo.hastaKm, null);
});

test("con la distancia, la zona que toca; fuera de la última, fuera", () => {
  assert.deepEqual(
    [1200, 3000, 3001, 8900].map((d) => cotizarEnvio(conZonas, { subtotal: 20000, distanciaM: d }).costo),
    [3000, 3000, 5000, 7000],
  );
  const lejos = cotizarEnvio(conZonas, { subtotal: 20000, distanciaM: 9500 });
  assert.equal(lejos.fuera, true);
  assert.equal(lejos.costo, null);
  assert.equal(cotizarEnvio(conZonas, { subtotal: 20000, distanciaM: 4000 }).minutos, 50);
});

test("sin la distancia se cobra la zona más cara, como estimado", () => {
  const q = cotizarEnvio(conZonas, { subtotal: 20000, distanciaM: null });
  assert.equal(q.estimado, true);
  assert.equal(q.costo, 7000);
  assert.equal(q.fuera, false);
  // El envío fijo no necesita distancia.
  const f = cotizarEnvio(fijo, { subtotal: 20000 });
  assert.deepEqual([f.costo, f.estimado, f.minutos], [4000, false, 40]);
});

test("el mínimo dice cuánto falta, y el envío gratis se aplica con el subtotal", () => {
  assert.equal(cotizarEnvio(conZonas, { subtotal: 11000, distanciaM: 1000 }).falta, 4000);
  assert.equal(cotizarEnvio(conZonas, { subtotal: 15000, distanciaM: 1000 }).falta, 0);
  // Sin subtotal (un pedido escrito a mano) no se puede comprobar el mínimo.
  assert.equal(cotizarEnvio(conZonas, { subtotal: null, distanciaM: 1000 }).falta, 0);
  const gratis = cotizarEnvio(conZonas, { subtotal: 40000, distanciaM: 5000 });
  assert.deepEqual([gratis.gratis, gratis.costo, gratis.minutos], [true, 0, 50]);
});

test("las reglas dichas en una oración", () => {
  assert.equal(
    textoDeEnvio(conZonas),
    "Envío: $30 hasta 3 km, $50 hasta 6 km y $70 hasta 9 km. Gratis desde $400. Pedido mínimo a domicilio: $150.",
  );
  assert.equal(textoDeEnvio(fijo), "Envío: $40.");
  assert.equal(
    textoDeEnvio(reglasDeEnvio({ delivery_zones: [{ max_km: 3, fee_cents: 0 }, { max_km: null, fee_cents: 3500 }] })),
    "Envío: gratis hasta 3 km y $35 más lejos.",
  );
  assert.equal(textoDeEnvio(reglasDeEnvio({ pickup_minutes: 15 })), null);
});

test("el renglón del envío en el resumen", () => {
  const q = cotizarEnvio(conZonas, { subtotal: 20000, distanciaM: 2430 });
  assert.equal(renglonDeEnvio(q, { distanciaM: 2430, reglas: conZonas }), "Envío: $30 (2.4 km)");
  assert.equal(
    renglonDeEnvio(cotizarEnvio(conZonas, { subtotal: 50000, distanciaM: 2430 }), { reglas: conZonas }),
    "Envío: gratis (tu pedido pasa de $400)",
  );
  assert.equal(
    renglonDeEnvio(cotizarEnvio(conZonas, { subtotal: 20000 }), { reglas: conZonas }),
    "Envío: $70. Lo confirmamos con tu dirección.",
  );
  assert.equal(renglonDeEnvio(cotizarEnvio(fijo, {}), { reglas: fijo, distanciaM: 2430 }), "Envío: $40");
});

test("distancias y tiempos como se dicen", () => {
  assert.deepEqual([40, 840, 1000, 2430, 12000].map(distanciaLegible), ["100 m", "800 m", "1 km", "2.4 km", "12 km"]);
  assert.deepEqual([35, 60, 90, 120].map(minutosLegibles), ["unos 35 minutos", "una hora", "1 h 30 min", "2 horas"]);
});

test("el formulario del panel se lee, y avisa del primer error", () => {
  const bien = leerEnvioDelFormulario(
    formulario({
      envio_minimo: "150",
      envio_gratis: "$400",
      envio_llevar_minutos: "20",
      envio_km_0: "3",
      envio_costo_0: "30",
      envio_minutos_0: "35",
      envio_km_1: "",
      envio_costo_1: "50",
      envio_minutos_1: "",
    }),
  );
  assert.deepEqual(bien.valores, {
    delivery_min_cents: 15000,
    delivery_free_from_cents: 40000,
    delivery_zones: [
      { max_km: 3, fee_cents: 3000, minutes: 35 },
      { max_km: null, fee_cents: 5000, minutes: null },
    ],
    pickup_minutes: 20,
  });
  // Y vuelve a los campos igual que se escribió.
  const campos = camposDeEnvio(bien.valores);
  assert.deepEqual([campos.minimo, campos.zonas[0].km, campos.zonas[1].km, campos.zonas[2].costo], ["150", "3", "", ""]);

  const errores = [
    [{ envio_km_0: "3" }, /Falta el costo de envío de la zona 1/],
    [{ envio_km_0: "3", envio_costo_0: "30", envio_km_1: "2", envio_costo_1: "40" }, /pasar de 3 km/],
    [{ envio_costo_0: "30", envio_km_1: "5", envio_costo_1: "40" }, /Solo la última zona/],
    [{ envio_km_0: "80", envio_costo_0: "30" }, /va de 0.1 a 50 km/],
    [{ envio_km_0: "3", envio_costo_0: "30", envio_minutos_0: "2" }, /tiempo de la zona 1/],
    [{ envio_minimo: "mucho" }, /pedido mínimo/],
    [{ envio_llevar_minutos: "500" }, /tiempo para llevar/],
  ];
  for (const [campos, patron] of errores) {
    assert.match(leerEnvioDelFormulario(formulario(campos)).error ?? "", patron, JSON.stringify(campos));
  }
  // Todo vacío: sin reglas.
  assert.deepEqual(leerEnvioDelFormulario(formulario({})).valores, {
    delivery_min_cents: null,
    delivery_free_from_cents: null,
    delivery_zones: [],
    pickup_minutes: null,
  });
});
