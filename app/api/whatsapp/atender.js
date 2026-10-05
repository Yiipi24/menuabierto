import { cargar, direccionDe } from "../../_ficha/datos";
import { confirmacionDePedido, errorAlGuardar, responder, PAUSA_MINUTOS } from "../../../lib/asistente";
import { reportarError } from "../../../lib/errores";
import { enviarMensajes, marcarLeido } from "../../../lib/meta";
import { codigoDePedido, filaDePedido } from "../../../lib/pedidos";
import { asistenteIncluido } from "../../../lib/planes";
import { repartirPush } from "../../../lib/push";
import { conEsquema } from "../../../lib/redes";
import { urlDelSitio } from "../../../lib/sitio";
import { rutaFicha, rutaMenu } from "../../../lib/slug";
import { supabaseServicio } from "../../../lib/supabase";
import { fueraDeTiempo, leerAviso } from "../../../lib/whatsapp-cloud";

// Atender un aviso del webhook de WhatsApp: todo lo que pasa después de
// contestarle 200 a Meta.
//
// Por cada mensaje: se comprueba que no se haya atendido ya (Meta reintenta),
// se carga la ficha del restaurante —la misma que ve cualquiera, de la caché,
// con el "abierto ahora" del momento—, el asistente decide qué contestar
// (`lib/asistente.js`), se guarda el chat y, si el cliente confirmó, el
// pedido. Luego se contesta, y al dueño le sale el aviso por push.
//
// Todo corre con la llave de servicio: aquí no hay usuario que represente a
// nadie, igual que en el webhook del cobro.

// Qué número es de qué restaurante. Un número que no está conectado —o que se
// desactivó— no se atiende: puede ser de otra aplicación en la misma cuenta.
// Tampoco el de un restaurante sin el plan Pedidos vigente: el asistente es de
// ese plan, y con el plan vencido el número queda como pausado.
async function lineasActivas(supabase, ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from("whatsapp_lines")
    .select("phone_number_id, restaurant_id, answers_in_app, restaurants (slug, plan, premium_until)")
    .in("phone_number_id", ids)
    .eq("is_active", true);
  if (error) throw error;
  return new Map(
    (data ?? []).filter((l) => asistenteIncluido(l.restaurants)).map((l) => [l.phone_number_id, l]),
  );
}

// Lo que el asistente sabe del restaurante, sacado de lo que la ficha ya
// carga. Nada de esto es otra consulta.
function fichaDelAsistente(datos, linea) {
  const { r } = datos;
  return {
    nombre: r.name,
    zona: r.timezone,
    telefono: String(r.phone ?? "").trim() || null,
    web: conEsquema(r.website),
    direccion: direccionDe(r) || null,
    urlFicha: urlDelSitio(rutaFicha(r.slug)),
    urlCarta: urlDelSitio(rutaMenu(r.slug)),
    horarios: datos.horarios,
    cerrados: datos.cerrados,
    abierto: datos.abierto,
    pedidos: datos.pedidos,
    menus: datos.menus,
    redes: datos.redes,
    pagos: datos.pagos ?? [],
    domicilio: (Array.isArray(r.amenities) ? r.amenities : []).includes("domicilio"),
    atiendeEnApp: Boolean(linea.answers_in_app),
  };
}

// El código lo sortea la aplicación y lo garantiza el índice único: si sale
// uno repetido, se sortea otro. Si lo que choca es la clave de la
// confirmación, el pedido ya lo guardó otro aviso —el mismo "Confirmar" tocado
// dos veces, atendido a la vez— y este no guarda ni contesta nada.
//
// Devuelve `{ codigo }`, `{ repetido: true }` o `null` si no se pudo.
async function guardarPedido(supabase, restauranteId, pedido, cliente) {
  for (let intento = 0; intento < 5; intento += 1) {
    const codigo = codigoDePedido();
    const { error } = await supabase.from("orders").insert(
      filaDePedido({
        restauranteId,
        codigo,
        origen: pedido.origen,
        cliente,
        entrega: pedido.entrega,
        direccion: pedido.direccion,
        ubicacion: pedido.ubicacion,
        nota: pedido.nota,
        libre: pedido.libre,
        lineas: pedido.lineas,
        clave: pedido.clave,
      }),
    );
    if (!error) return { codigo };
    if (error.code === "23505" && /una_confirmacion/.test(error.message ?? "")) return { repetido: true };
    if (error.code !== "23505") {
      // Un pedido que no se guarda es una venta perdida: va al canal de
      // errores, no solo al log.
      await reportarError(error, { ruta: "/api/whatsapp", tipo: "pedido" });
      return null;
    }
  }
  return null;
}

async function atenderMensaje(supabase, linea, m, ahora) {
  const clave = m.cliente.telefono ?? m.cliente.usuario;
  if (!linea || !clave || fueraDeTiempo(m.momento, ahora.getTime())) return;

  const { data: nuevo, error } = await supabase.rpc("whatsapp_mensaje_nuevo", {
    p_id: m.id,
    p_restaurant: linea.restaurant_id,
  });
  if (error) throw error;
  if (!nuevo) return;

  const [datos, { data: chat, error: sinChat }] = await Promise.all([
    cargar(linea.restaurants?.slug ?? ""),
    supabase
      .from("whatsapp_chats")
      .select("state, customer_name, paused_until")
      .eq("restaurant_id", linea.restaurant_id)
      .eq("customer", clave)
      .maybeSingle(),
    // Las palomitas azules no pueden tumbar la respuesta.
    marcarLeido(linea.phone_number_id, m.id).catch(() => null),
  ]);
  // Sin poder leer el chat no se contesta: tratarlo como nuevo borraría el
  // pedido que el cliente iba armando al guardar.
  if (sinChat) throw sinChat;

  // Una ficha oculta o en borrador no se atiende: el asistente habla por la
  // ficha pública, y los enlaces que manda no abrirían.
  if (!datos) {
    console.error("asistente: la ficha del número no está publicada", linea.phone_number_id);
    return;
  }

  const ficha = fichaDelAsistente(datos, linea);
  const nombre = m.cliente.nombre ?? chat?.customer_name ?? null;
  const resultado = responder({
    ficha,
    chat: { estado: chat?.state, nombre, pausadoHasta: chat?.paused_until, nuevo: !chat },
    entrada: m,
    ahora,
  });

  let mensajes = resultado.mensajes;
  let estado = resultado.estado;
  let codigo = null;
  if (resultado.pedido) {
    const guardado = await guardarPedido(supabase, linea.restaurant_id, resultado.pedido, { ...m.cliente, nombre });
    if (guardado?.codigo) {
      codigo = guardado.codigo;
      mensajes = confirmacionDePedido(ficha, { codigo, cliente: nombre });
      estado = { ...estado, ultimoPedido: { codigo, en: ahora.toISOString() } };
    } else if (guardado?.repetido) {
      // El otro aviso ya contestó con el código; aquí no se dice nada más, y
      // el chat recuerda el mismo pedido gane quien gane al guardar.
      mensajes = [];
      const { data: previo } = await supabase
        .from("orders")
        .select("code, created_at")
        .eq("restaurant_id", linea.restaurant_id)
        .eq("confirmation_key", resultado.pedido.clave)
        .maybeSingle();
      if (previo) estado = { ...estado, ultimoPedido: { codigo: previo.code, en: previo.created_at } };
    } else {
      mensajes = errorAlGuardar();
      estado = resultado.estadoSiFalla ?? estado;
    }
  }

  // El chat se guarda antes de contestar: si Meta falla al entregar, el
  // siguiente mensaje del cliente encuentra el paso en que iba. La pausa solo
  // se escribe cuando se pone: un eco del dueño que llegó mientras tanto no se
  // borra con el valor que se leyó antes.
  const fila = {
    restaurant_id: linea.restaurant_id,
    customer: clave,
    customer_phone: m.cliente.telefono,
    customer_user_id: m.cliente.usuario,
    customer_name: nombre,
    state: estado,
    last_inbound_at: new Date(m.momento).toISOString(),
  };
  if (resultado.pausar) {
    fila.paused_until = new Date(ahora.getTime() + resultado.pausar * 60_000).toISOString();
  }
  const { error: sinGuardar } = await supabase
    .from("whatsapp_chats")
    .upsert(fila, { onConflict: "restaurant_id,customer" });
  if (sinGuardar) throw sinGuardar;

  try {
    if (mensajes.length) await enviarMensajes(linea.phone_number_id, m.cliente, mensajes);
  } finally {
    // El aviso al dueño lo escribió el trigger del pedido; sale por push ya,
    // no en la vuelta del cron, y aunque Meta no haya entregado la
    // confirmación: el pedido está guardado y alguien tiene que atenderlo.
    if (codigo) await repartirPush();
  }
}

// El dueño contestó a mano desde su teléfono: el asistente se calla en ese
// chat un rato. Si el cliente nunca le había escrito al asistente, se crea el
// chat solo para dejar la pausa puesta.
async function atenderEco(supabase, linea, eco, ahora) {
  const clave = eco.para.telefono ?? eco.para.usuario;
  if (!linea || !clave) return;
  const fila = {
    restaurant_id: linea.restaurant_id,
    customer: clave,
    paused_until: new Date(ahora.getTime() + PAUSA_MINUTOS * 60_000).toISOString(),
  };
  if (eco.para.telefono) fila.customer_phone = eco.para.telefono;
  if (eco.para.usuario) fila.customer_user_id = eco.para.usuario;
  const { error } = await supabase.from("whatsapp_chats").upsert(fila, { onConflict: "restaurant_id,customer" });
  if (error) throw error;
}

export async function atenderAviso(aviso, ahora = new Date()) {
  const { mensajes, ecos } = leerAviso(aviso);
  if (!mensajes.length && !ecos.length) return;

  const supabase = supabaseServicio();
  const lineas = await lineasActivas(supabase, [...new Set([...mensajes, ...ecos].map((m) => m.linea))]);

  for (const eco of ecos) {
    try {
      await atenderEco(supabase, lineas.get(eco.linea), eco, ahora);
    } catch (error) {
      await reportarError(error, { ruta: "/api/whatsapp", tipo: "eco" });
    }
  }

  // De uno en uno y en orden: dos mensajes seguidos del mismo cliente leen y
  // escriben el mismo estado, y atenderlos a la vez haría que uno pisara al
  // otro.
  for (const m of mensajes) {
    try {
      await atenderMensaje(supabase, lineas.get(m.linea), m, ahora);
    } catch (error) {
      await reportarError(error, { ruta: "/api/whatsapp", tipo: "mensaje" });
    }
  }
}
