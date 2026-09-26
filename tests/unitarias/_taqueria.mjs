// Una taquería de Monterrey para las pruebas del asistente y de los pedidos:
// dos cartas digitales —la de todo el día y la de desayunos, que a las ocho de
// la noche ya no se sirve— y una de bebidas en PDF.
//
// No termina en `.test.mjs`, así que `npm test` no la corre como prueba; el
// guion bajo es el de los otros ayudantes de esta carpeta.

import { opcionesDeEntrega, pedidosDe } from "../../lib/whatsapp.js";

function platillo(id, name, price_cents, extra = {}) {
  return { id, name, price_cents, currency: "MXN", is_available: true, ...extra };
}

export const MENUS = [
  {
    id: "m1",
    name: "Carta",
    kind: "digital",
    service_time: "siempre",
    grupos: [
      {
        id: "s-tacos",
        name: "Tacos",
        items: [
          platillo("p-trompo", "Tacos de trompo", 2500),
          platillo("p-pastor", "Tacos de pastor", 2500),
          platillo("p-bistec", "Tacos de bistec", 3000),
          platillo("p-pastor-queso", "Tacos de pastor con queso", 3200),
        ],
      },
      {
        id: "s-gringas",
        name: "Gringas",
        items: [
          platillo("p-gringa-pastor", "Gringa de pastor", 6500),
          platillo("p-gringa-sirloin", "Gringa de sirloin", 7500),
        ],
      },
      {
        id: "s-bebidas",
        name: "Bebidas",
        items: [
          platillo("p-coca", "Coca-Cola 600 ml", 3500),
          platillo("p-coca-light", "Coca-Cola light", 3500),
          platillo("p-horchata", "Agua de horchata", 3000),
          platillo("p-jamaica", "Agua de jamaica", 3000),
          platillo("p-agotada", "Agua de tamarindo", 3000, { is_available: false }),
        ],
      },
      {
        id: "m1-sueltos",
        name: "Otros platillos",
        items: [platillo("p-pastel", "Pastel de tres leches", 5500), platillo("p-sinprecio", "Salsa extra", null)],
      },
    ],
  },
  {
    id: "m2",
    name: "Desayunos",
    kind: "digital",
    service_time: "desayuno",
    grupos: [{ id: "s-desayunos", name: "Desayunos", items: [platillo("p-machacado", "Machacado con huevo", 9500)] }],
  },
  {
    id: "m3",
    name: "Bebidas en PDF",
    kind: "archivo",
    fileMime: "application/pdf",
    fileUrl: "https://x.supabase.co/storage/v1/object/public/menus/bebidas.pdf",
    grupos: [],
  },
];

export const ZONA = "America/Monterrey";
// Lunes 28 de septiembre, 20:00 en Monterrey (UTC-6 todo el año): la carta se
// sirve, el desayuno no. En UTC ya es martes.
export const NOCHE = new Date("2026-09-29T02:00:00Z");
// Lunes 09:00 en Monterrey: los dos; el local todavía no abre.
export const MANANA = new Date("2026-09-28T15:00:00Z");

// De lunes a sábado de 1 pm a 11 pm; el domingo cierra.
export const HORARIOS = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "13:00:00", closes: "23:00:00" }));

const restaurante = {
  whatsapp_orders: true,
  whatsapp_phone: "528112345678",
  whatsapp_note: "Pedido mínimo $150 a domicilio.",
  service_mode: "ambos",
  amenities: ["domicilio"],
};

export function ficha(cambios = {}) {
  return {
    nombre: "Taquería El Trompo",
    zona: ZONA,
    telefono: "81 8000 1234",
    web: "https://eltrompo.mx",
    direccion: "Padre Mier 123, Centro, Monterrey",
    urlFicha: "https://menuabierto.com/eltrompo",
    urlCarta: "https://menuabierto.com/eltrompo/menu",
    horarios: HORARIOS,
    cerrados: [0],
    abierto: true,
    pedidos: pedidosDe(restaurante),
    menus: MENUS,
    redes: [{ nombre: "Instagram", url: "https://instagram.com/eltrompo" }],
    pagos: [{ nombre: "Efectivo" }, { nombre: "Tarjeta de crédito" }, { nombre: "Transferencia" }],
    domicilio: true,
    atiendeEnApp: false,
    ...cambios,
  };
}

export { opcionesDeEntrega, pedidosDe };
