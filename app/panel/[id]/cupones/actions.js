"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invalidarFicha } from "../../../../lib/cache";
import { supabaseSession } from "../../../../lib/supabase";
import {
  aValorGuardado,
  codigoValido,
  llevaCifra,
  normalizarCodigo,
  tipoDe,
  tipoValido,
} from "../../../../lib/cupones";

// Mismo criterio que en los menús: la RLS ya impide tocar lo ajeno, pero
// comprobarlo aquí permite contestar "ese restaurante no es tuyo" en vez de
// devolver un update que no afectó a nadie.
async function sesionYRestaurante(id) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, slug")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  return { supabase, restaurante };
}

const NO_ES_TUYO = { status: "error", message: "Ese restaurante no es tuyo." };
const NO_ES_TU_CUPON = { status: "error", message: "Ese cupón no es tuyo." };

// Un cupón vive en la ficha pública, así que tocarlo tira su caché igual que
// tocar una carta.
function refrescar(restaurante) {
  revalidatePath(`/panel/${restaurante.id}/cupones`);
  revalidatePath("/panel");
  invalidarFicha(restaurante.slug);
}

// Una fecha suelta del formulario ("2026-09-30") es un día, no un instante. El
// inicio cuenta desde el primer minuto de ese día y el fin hasta el último:
// un cupón que vence "el 30" tiene que servir el 30 entero.
//
// Se arma en la hora del navegador del dueño, que es la del local salvo que
// esté administrando desde otro huso; para una vigencia de días esa diferencia
// no cambia nada y evita arrastrar la zona a cada campo del formulario.
function fecha(valor, finDelDia = false) {
  const v = String(valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T${finDelDia ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function tope(valor) {
  const v = String(valor ?? "").trim();
  if (!v) return null;
  const n = Number(v.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : undefined;
}

/**
 * Lee y valida el cupón que viene del formulario.
 *
 * Es la misma lectura al crear y al editar, y por eso vive aparte: si cada una
 * tuviera la suya, editar acabaría aceptando lo que crear rechaza.
 */
function cuponDelFormulario(formData) {
  const codigo = normalizarCodigo(formData.get("codigo"));
  if (!codigoValido(codigo)) {
    return {
      error:
        "El código lleva entre 3 y 16 letras o números, sin espacios ni signos. Por ejemplo: VERANO25.",
    };
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  if (titulo.length < 3) {
    return { error: "Ponle un título al cupón. Por ejemplo: 15% en toda la cuenta." };
  }
  if (titulo.length > 80) return { error: "Usa un título más corto." };

  const kind = tipoValido(String(formData.get("tipo") ?? ""));
  const valor = aValorGuardado(kind, formData.get("valor"));
  if (valor === undefined) {
    return {
      error:
        kind === "porcentaje"
          ? "El porcentaje va del 1 al 100."
          : "Escribe el monto del descuento. Por ejemplo: 50.",
    };
  }

  const descripcion = String(formData.get("descripcion") ?? "").trim();
  if (descripcion.length > 300) return { error: "La descripción es muy larga." };
  const condiciones = String(formData.get("condiciones") ?? "").trim();
  if (condiciones.length > 300) return { error: "Las condiciones son muy largas." };

  const desde = fecha(formData.get("desde"));
  const hasta = fecha(formData.get("hasta"), true);
  if (desde && hasta && new Date(hasta) <= new Date(desde)) {
    return { error: "La fecha de fin tiene que ir después de la de inicio." };
  }

  const maximo = tope(formData.get("maximo"));
  if (maximo === undefined) {
    return { error: "El máximo de canjes es un número mayor que cero, o déjalo vacío." };
  }

  return {
    cupon: {
      code: codigo,
      title: titulo,
      description: descripcion || null,
      terms: condiciones || null,
      kind,
      value_int: llevaCifra(kind) ? valor : null,
      starts_at: desde,
      ends_at: hasta,
      max_redemptions: maximo,
    },
  };
}

// 23505 es el índice único del código dentro del restaurante. Que choque no es
// un fallo que reportar en crudo: es "ese código ya lo estás usando".
function esCodigoRepetido(error) {
  return error?.code === "23505";
}

export async function crearCupon(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const { cupon, error: malo } = cuponDelFormulario(formData);
  if (malo) return { status: "error", message: malo };

  const { data, error } = await supabase
    .from("coupons")
    .insert({ restaurant_id: id, ...cupon })
    .select("id")
    .single();

  if (error) {
    if (esCodigoRepetido(error)) {
      return { status: "error", message: `Ya tienes un cupón con el código ${cupon.code}.` };
    }
    console.error("crear cupon", error.message);
    return { status: "error", message: "No pudimos crear el cupón." };
  }

  refrescar(restaurante);
  return { status: "ok", message: `Cupón ${cupon.code} creado.`, cuponId: data.id };
}

export async function guardarCupon(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const cuponId = String(formData.get("cupon") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const { cupon, error: malo } = cuponDelFormulario(formData);
  if (malo) return { status: "error", message: malo };

  const { error, count } = await supabase
    .from("coupons")
    .update(cupon, { count: "exact" })
    .eq("id", cuponId)
    .eq("restaurant_id", id);

  if (error) {
    if (esCodigoRepetido(error)) {
      return { status: "error", message: `Ya tienes otro cupón con el código ${cupon.code}.` };
    }
    console.error("guardar cupon", error.message);
    return { status: "error", message: "No pudimos guardar el cupón." };
  }
  if (count === 0) return NO_ES_TU_CUPON;

  refrescar(restaurante);
  return { status: "ok", message: "Cupón guardado." };
}

// Encender y apagar es lo que más se toca: la promoción del fin de semana se
// apaga el lunes y se vuelve a encender el viernes, y borrarla perdería lo que
// midió.
export async function alternarCupon(formData) {
  const id = String(formData.get("id") ?? "");
  const cuponId = String(formData.get("cupon") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const { data: cupon } = await supabase
    .from("coupons")
    .select("id, is_active")
    .eq("id", cuponId)
    .eq("restaurant_id", id)
    .maybeSingle();
  if (!cupon) return;

  await supabase
    .from("coupons")
    .update({ is_active: !cupon.is_active })
    .eq("id", cuponId)
    .eq("restaurant_id", id);

  refrescar(restaurante);
}

export async function borrarCupon(formData) {
  const id = String(formData.get("id") ?? "");
  const cuponId = String(formData.get("cupon") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", cuponId)
    .eq("restaurant_id", id);

  if (error) console.error("borrar cupon", error.message);
  refrescar(restaurante);
}

/**
 * Registrar un canje: alguien dijo el código en la caja.
 *
 * Es la mitad que convierte "lo vieron" en "vinieron", y por eso se busca por
 * código y no por id: quien lo captura está en la caja con el teléfono del
 * comensal enfrente, no eligiendo de una lista.
 *
 * El contador de la tabla lo lleva un trigger, así que aquí solo se inserta la
 * fila del canje.
 */
export async function canjearCupon(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return NO_ES_TUYO;

  const codigo = normalizarCodigo(formData.get("codigo"));
  if (!codigo) return { status: "error", message: "Escribe el código que trae el cliente." };

  // `ilike` sin comodines compara sin distinguir mayúsculas, que es lo mismo
  // que hace el índice único: quien escriba "verano25" encuentra su cupón.
  const { data: cupon } = await supabase
    .from("coupons")
    .select("id, code, title, is_active, starts_at, ends_at, max_redemptions, redemptions_count")
    .eq("restaurant_id", id)
    .ilike("code", codigo)
    .maybeSingle();

  if (!cupon) {
    return { status: "error", message: `No tienes ningún cupón con el código ${codigo}.` };
  }

  const ahora = Date.now();
  if (!cupon.is_active) {
    return { status: "error", message: `El cupón ${cupon.code} está apagado.` };
  }
  if (cupon.starts_at && new Date(cupon.starts_at).getTime() > ahora) {
    return { status: "error", message: `El cupón ${cupon.code} todavía no empieza.` };
  }
  if (cupon.ends_at && new Date(cupon.ends_at).getTime() <= ahora) {
    return { status: "error", message: `El cupón ${cupon.code} ya venció.` };
  }
  if (cupon.max_redemptions != null && cupon.redemptions_count >= cupon.max_redemptions) {
    return {
      status: "error",
      message: `El cupón ${cupon.code} llegó a sus ${cupon.max_redemptions} canjes.`,
    };
  }

  const nota = String(formData.get("nota") ?? "").trim().slice(0, 120);
  const { error } = await supabase
    .from("coupon_redemptions")
    .insert({ coupon_id: cupon.id, restaurant_id: id, note: nota || null });

  if (error) {
    console.error("canjear cupon", error.message);
    return { status: "error", message: "No pudimos registrar el canje." };
  }

  refrescar(restaurante);
  return { status: "ok", message: `Canje registrado: ${cupon.title}.` };
}

export async function deshacerCanje(formData) {
  const id = String(formData.get("id") ?? "");
  const canjeId = String(formData.get("canje") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  // Capturar un canje de más en plena caja es lo normal; el trigger devuelve
  // el contador al borrar la fila.
  const { error } = await supabase
    .from("coupon_redemptions")
    .delete()
    .eq("id", canjeId)
    .eq("restaurant_id", id);

  if (error) console.error("deshacer canje", error.message);
  refrescar(restaurante);
}
