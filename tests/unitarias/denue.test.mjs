import { test } from "node:test";
import assert from "node:assert/strict";
import {
  leerCsv,
  nombreLegible,
  cocinaDe,
  calleDe,
  telefonoDe,
  sitioDe,
  codigoPostalDe,
  fichaDesdeFila,
  esRestaurante,
} from "../../lib/denue.js";

test("el nombre en mayúsculas del DENUE se vuelve legible", () => {
  assert.equal(nombreLegible("TAQUERIA EL GORDO"), "Taqueria El Gordo");
  assert.equal(nombreLegible("RESTAURANTE LA CASA DE TOÑO SA DE CV"), "Restaurante La Casa de Toño");
  assert.equal(nombreLegible("MARISCOS EL PUERTO, S.A. DE C.V."), "Mariscos El Puerto");
  assert.equal(nombreLegible("D'ANGELO PIZZAS"), "D'Angelo Pizzas");
  assert.equal(nombreLegible("Smoke House BBQ"), "Smoke House BBQ");
  assert.equal(nombreLegible("   "), "");
});

test("la cocina sale del nombre antes que de la clase SCIAN", () => {
  assert.equal(cocinaDe("TAQUERIA EL GORDO", "722511"), "tacos");
  assert.equal(cocinaDe("MARISCOS EL PUERTO", "722511"), "mariscos");
  assert.equal(cocinaDe("FONDA DOÑA MARY", "722511"), "comida-corrida");
  assert.equal(cocinaDe("COMEDOR SIN NOMBRE", "722511"), "comida-corrida");
  assert.equal(cocinaDe("LONCHERIA X", "722519"), null);
  assert.equal(esRestaurante("722514"), true);
  assert.equal(esRestaurante("461110"), false);
});

test("la dirección, el teléfono, el sitio y el código postal se limpian", () => {
  assert.equal(calleDe({ tipo_vial: "AVENIDA", nom_vial: "BENITO JUAREZ", numero_ext: "120", numero_int: "0" }), "Av. Benito Juarez 120");
  assert.equal(calleDe({ tipo_vial: "CALLE", nom_vial: "HIDALGO", numero_ext: "SN" }), "Hidalgo");
  assert.equal(calleDe({ tipo_vial: "CALLE", nom_vial: "" }), null);
  assert.equal(telefonoDe("81 1234 5678"), "8112345678");
  assert.equal(telefonoDe("528112345678"), "8112345678");
  assert.equal(telefonoDe("123"), null);
  assert.equal(sitioDe("www.tacos.mx"), "https://www.tacos.mx");
  assert.equal(sitioDe("hola@tacos.mx"), null);
  assert.equal(sitioDe("NINGUNO"), null);
  assert.equal(codigoPostalDe("6600"), "06600");
});

const CSV = `﻿ID,Nombre de la Unidad Económica,Razón social,Código de la clase de actividad SCIAN,Nombre de la clase de la actividad,Tipo de vialidad,Nombre de la vialidad,Número exterior o kilómetro,Letra exterior,Número interior,Tipo de asentamiento humano,Nombre de asentamiento humano,Código postal,Entidad federativa,Municipio,Localidad,Teléfono,Correo electrónico,Sitio en Internet,Latitud,Longitud
1234,"TACOS ""EL GORDO""",TACOS EL GORDO SA DE CV,722514,Restaurantes con servicio de preparación de tacos y tortas,AVENIDA,REVOLUCION,1500,,,COLONIA,CENTRO,64000,NUEVO LEÓN,MONTERREY,MONTERREY,8112345678,,www.tacoselgordo.mx,25.671234,-100.309876
1235,FERRETERIA LOPEZ,,461110,Comercio,CALLE,HIDALGO,3,,,COLONIA,CENTRO,64000,NUEVO LEÓN,MONTERREY,MONTERREY,,,,25.67,-100.30
`;

test("leerCsv y fichaDesdeFila convierten el archivo del INEGI en fichas", () => {
  const filas = leerCsv(CSV);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].nom_estab, 'TACOS "EL GORDO"');
  assert.equal(filas[0].codigo_act, "722514");

  const ficha = fichaDesdeFila(filas[0]);
  assert.equal(ficha.source, "denue");
  assert.equal(ficha.source_id, "1234");
  assert.equal(ficha.name, 'Tacos "El Gordo"');
  assert.equal(ficha.street, "Av. Revolucion 1500");
  assert.equal(ficha.neighborhood, "Centro");
  assert.equal(ficha.city, "Monterrey");
  assert.equal(ficha.state, "Nuevo León");
  assert.equal(ficha.postal_code, "64000");
  assert.equal(ficha.phone, "8112345678");
  assert.equal(ficha.website, "https://www.tacoselgordo.mx");
  assert.equal(ficha.lat, 25.671234);
  assert.equal(ficha.lng, -100.309876);
  assert.equal(ficha.cocina, "tacos");

  assert.equal(fichaDesdeFila(filas[1]), null, "una ferretería no es un restaurante");
});
