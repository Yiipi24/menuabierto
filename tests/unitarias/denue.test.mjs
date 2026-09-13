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
  sinNumeroDeTienda,
  motivoDeDescarte,
  descarteDeFila,
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

test("el número de sucursal de la cadena no es parte del nombre", () => {
  assert.equal(sinNumeroDeTienda("38224 Starbucks Revolucion"), "Starbucks Revolucion");
  assert.equal(sinNumeroDeTienda("M00020 Mc Donalds Gonzalitos (Mty)"), "Mc Donalds Gonzalitos (Mty)");
  assert.equal(sinNumeroDeTienda("1516 P.f. Changs Nuevo Sur Mty"), "P.f. Changs Nuevo Sur Mty");
  assert.equal(sinNumeroDeTienda("81093 VIPS Paseo de Los Leones"), "VIPS Paseo de Los Leones");
  // El 706 del final es parte del nombre de esa sucursal, no un prefijo.
  assert.equal(sinNumeroDeTienda("M07060 Mc Donalds Monterrey Kidzania 706"), "Mc Donalds Monterrey Kidzania 706");
});

test("un nombre que de verdad empieza con número se queda entero", () => {
  assert.equal(sinNumeroDeTienda("100 Montaditos"), "100 Montaditos", "tres dígitos no es un número de tienda");
  assert.equal(sinNumeroDeTienda("1000 Sabores"), "1000 Sabores", "quitarlo dejaría una sola palabra");
  assert.equal(sinNumeroDeTienda("300 Gramos Steak House"), "300 Gramos Steak House");
  assert.equal(sinNumeroDeTienda("Tacos 1000"), "Tacos 1000");
  assert.equal(sinNumeroDeTienda(""), "");
  assert.equal(sinNumeroDeTienda(null), "");
});

test("las unidades donde no come nadie se descartan por el nombre", () => {
  assert.equal(motivoDeDescarte("Bodega de Tacos El Cuate"), "unidad de apoyo");
  assert.equal(motivoDeDescarte("Bodegas del Torito Alimentos Tipicos"), "unidad de apoyo");
  assert.equal(motivoDeDescarte("Almacen Tacos Dany"), "unidad de apoyo");
  assert.equal(motivoDeDescarte("Auxiliar de Comidas Caseras"), "unidad de apoyo");
  assert.equal(motivoDeDescarte("Estacionamiento del Torito"), "unidad de apoyo");
  assert.equal(motivoDeDescarte("Oficinas Administrativas de Super Salads"), "unidad de apoyo");
  assert.equal(motivoDeDescarte("Club de Nutricion Herbalife"), "club de nutrición");
  assert.equal(motivoDeDescarte("Clud de Nutricion Zona Verde"), "club de nutrición");
  assert.equal(motivoDeDescarte("Club Nutricional"), "club de nutrición");
  assert.equal(motivoDeDescarte("Hierbalife Nutricion"), "club de nutrición");
  assert.equal(motivoDeDescarte("Cooperativa Escolar Secundaria 35 Tm"), "cooperativa escolar");
  assert.equal(motivoDeDescarte("Ecoes Tienda Escolar"), "cooperativa escolar");
});

test("un restaurante de verdad no se descarta aunque se le parezca", () => {
  assert.equal(motivoDeDescarte("La Bodega de Chema"), null, "el patrón va anclado al principio");
  assert.equal(motivoDeDescarte("Tacos La Bodega"), null);
  assert.equal(motivoDeDescarte("Mi Nutricion Favorita"), null, "sin club ni marca, puede ser comida saludable");
  assert.equal(motivoDeDescarte("Club de Golf La Herradura"), null, "club sin nutrición no dice nada");
  assert.equal(motivoDeDescarte("Cafeteria Escolar Tec"), null, "solo cooperativa o tienda escolar");
  assert.equal(motivoDeDescarte("Taqueria El Gordo"), null);
  assert.equal(motivoDeDescarte(""), null);
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

// Las tres formas de ruido que trae el DENUE en 7225xx, tal como vienen.
const CSV_RUIDO = `ID,Nombre de la Unidad Económica,Razón social,Código de la clase de actividad SCIAN,Nombre de la clase de la actividad,Tipo de vialidad,Nombre de la vialidad,Número exterior o kilómetro,Letra exterior,Número interior,Tipo de asentamiento humano,Nombre de asentamiento humano,Código postal,Entidad federativa,Municipio,Localidad,Teléfono,Correo electrónico,Sitio en Internet,Latitud,Longitud
2001,38224 STARBUCKS REVOLUCION,,722515,Cafeterías,AVENIDA,REVOLUCION,900,,,COLONIA,CENTRO,64000,NUEVO LEÓN,MONTERREY,MONTERREY,,,,25.66,-100.31
2002,BODEGA DE TACOS EL CUATE,,722514,Restaurantes de tacos,CALLE,LERDO,45,,,COLONIA,LOMAS MODELO,64100,NUEVO LEÓN,MONTERREY,MONTERREY,,,,25.72,-100.35
2003,CLUB DE NUTRICION HERBALIFE,,722515,Cafeterías,CALLE,JUAREZ,7,,,COLONIA,OBRERA,64010,NUEVO LEÓN,MONTERREY,MONTERREY,,,,25.68,-100.32
2004,COOPERATIVA ESCOLAR SECUNDARIA 35 TM,,722519,Otros alimentos,CALLE,ZARAGOZA,12,,,COLONIA,MODERNA,64530,NUEVO LEÓN,MONTERREY,MONTERREY,,,,25.70,-100.33
`;

test("la siembra deja fuera el ruido del DENUE y limpia el nombre de la cadena", () => {
  const filas = leerCsv(CSV_RUIDO);
  assert.equal(filas.length, 4);

  const [cadena, bodega, club, escolar] = filas;

  const ficha = fichaDesdeFila(cadena);
  assert.equal(ficha.name, "Starbucks Revolucion", "el número de sucursal no llega a la ficha");
  assert.equal(ficha.cocina, "desayunos");
  assert.equal(descarteDeFila(cadena), null);

  assert.equal(fichaDesdeFila(bodega), null);
  assert.equal(fichaDesdeFila(club), null);
  assert.equal(fichaDesdeFila(escolar), null);

  assert.equal(descarteDeFila(bodega), "unidad de apoyo");
  assert.equal(descarteDeFila(club), "club de nutrición");
  assert.equal(descarteDeFila(escolar), "cooperativa escolar");
});

test("descarteDeFila calla sobre lo que nunca fue candidato", () => {
  const [, ferreteria] = leerCsv(CSV);
  assert.equal(descarteDeFila(ferreteria), null, "una ferretería no es un descarte, es otro giro");
});
