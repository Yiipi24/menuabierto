// Trampa para bots: un campo que nadie ve y que el servidor exige vacio.
//
// El campo se llamaba "company" y ahi estaba el fallo. Chrome, Safari y los
// gestores de contrasenas rellenan los campos de organizacion por su nombre,
// aunque esten fuera de pantalla y lleven autocomplete="off". A quien tuviera
// guardada su empresa se le llenaba la trampa sola: el alta se descartaba en
// silencio y la pantalla prometia un correo de confirmacion que nunca salia.
// El nombre de ahora no se parece a ningun dato de una libreta de direcciones.
export const CAMPO_TRAMPA = "ma_control";

// readOnly no frena a un bot (puede escribir el valor por JS o mandar el POST
// a mano) pero corta en seco el autorrelleno del navegador, que es de donde
// venian los falsos positivos.
export const PROPS_TRAMPA = {
  type: "text",
  name: CAMPO_TRAMPA,
  defaultValue: "",
  readOnly: true,
  tabIndex: -1,
  autoComplete: "off",
  "aria-hidden": true,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  className: "trap",
};

export function trampaActivada(valor) {
  return String(valor ?? "").trim().length > 0;
}
