"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseSession } from "../../../lib/supabase";
import { geocodificar, mismaDireccion } from "../../../lib/geocodificar";

const BUCKET_FOTOS = "restaurantes";
const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// Todo lo de esta página exige ser el dueño. Se comprueba aquí además de en la
// RLS para poder responder con un mensaje claro en vez de un update vacío.
async function sesionYRestaurante(id) {
  const supabase = await supabaseSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/entrar");

  // Se traen también la dirección y el punto actuales: con ellos se decide si
  // hace falta volver a preguntarle a Nominatim o si ya está resuelto.
  // `location` es geography y PostgREST la manda en hexadecimal; aquí solo
  // interesa si viene o no, no su contenido.
  const { data: restaurante } = await supabase
    .from("restaurants")
    .select("id, street, neighborhood, city, state, postal_code, location")
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  return { supabase, user: auth.user, restaurante };
}

function aSlug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function limpio(formData, campo) {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor || null;
}

// Los dos campos de coordenadas son texto para que se pueda pegar el par de
// Google Maps de una vez. Aquí vuelven a ser números, o nada.
function aCoordenada(formData, campo) {
  const bruto = limpio(formData, campo);
  if (bruto === null) return null;
  const numero = Number(bruto.replace(",", "."));
  return Number.isFinite(numero) ? numero : NaN;
}

export async function guardarRestaurante(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) {
    return { status: "error", message: "Ese restaurante no es tuyo." };
  }

  const nombre = String(formData.get("name") ?? "").trim();
  const ciudad = String(formData.get("city") ?? "").trim();
  const nivel = Number(formData.get("price_level") ?? 2);

  if (nombre.length < 2) {
    return { status: "error", message: "El nombre es obligatorio." };
  }
  if (ciudad.length < 2) {
    return { status: "error", message: "La ciudad es obligatoria." };
  }
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 4) {
    return { status: "error", message: "Elige un rango de precio." };
  }

  const punto = leerUbicacion(formData);
  if (punto.error) return { status: "error", message: punto.error };

  const direccion = {
    street: limpio(formData, "street"),
    neighborhood: limpio(formData, "neighborhood"),
    city: ciudad,
    state: limpio(formData, "state"),
    postal_code: limpio(formData, "postal_code"),
  };

  const sitio = limpio(formData, "website");
  // Sin esquema el enlace se resuelve contra menuabierto.com y no lleva a
  // ningún lado; añadirlo nosotros evita pedírselo al dueño.
  const website = sitio && !/^https?:\/\//i.test(sitio) ? `https://${sitio}` : sitio;

  const { error } = await supabase
    .from("restaurants")
    .update({
      name: nombre,
      summary: limpio(formData, "summary"),
      description: limpio(formData, "description"),
      ...direccion,
      phone: limpio(formData, "phone"),
      website,
      price_level: nivel,
    })
    .eq("id", id);

  if (error) {
    console.error("guardar restaurante", error.message);
    return { status: "error", message: "No pudimos guardar los cambios." };
  }

  const errorPunto = await guardarUbicacion(supabase, id, punto);
  if (errorPunto) return errorPunto;

  const errorCategorias = await guardarCategorias(supabase, id, formData);
  if (errorCategorias) return errorCategorias;

  const errorHorarios = await guardarHorarios(supabase, id, formData);
  if (errorHorarios) return errorHorarios;

  // Al final, y a propósito: preguntarle a un servicio de terceros es lo único
  // aquí que puede tardar segundos. Si va antes y se atora, la ficha se queda
  // sin categorías ni horarios por culpa de algo que ni siquiera es nuestro.
  if (punto.lat === null) {
    await completarUbicacion(supabase, id, direccion, restaurante);
  }

  revalidatePath("/panel");
  revalidatePath(`/panel/${id}`);
  return { status: "ok", message: "Cambios guardados." };
}

// Se valida antes de escribir nada, no al llegar el turno del punto: si el
// aviso saliera después del primer update, la ficha se quedaría con el nombre
// y la dirección nuevos, sin categorías ni horarios, y con un mensaje que dice
// que no se guardó nada. Devuelve el punto listo, o el error a mostrar.
function leerUbicacion(formData) {
  const lat = aCoordenada(formData, "lat");
  const lng = aCoordenada(formData, "lng");

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return {
      error: "La latitud y la longitud tienen que ser números. Ejemplo: 25.79000 y -100.31500.",
    };
  }
  // Media coordenada no ubica nada, y guardarla a medias deja la ficha creyendo
  // que ya tiene punto.
  if ((lat === null) !== (lng === null)) {
    return {
      error: "Faltó una de las dos coordenadas. Pon latitud y longitud, o deja las dos vacías.",
    };
  }
  if (lat !== null && (lat < -90 || lat > 90)) {
    return { error: "La latitud va entre -90 y 90." };
  }
  if (lng !== null && (lng < -180 || lng > 180)) {
    return { error: "La longitud va entre -180 y 180." };
  }

  return { lat, lng };
}

// Un punto escrito a mano gana siempre: el dueño conoce su local mejor que
// cualquier geocodificador. Se escribe aquí, junto al resto de la ficha,
// porque es una llamada rápida y su fallo sí es un error que contar.
//
// El punto no se escribe con un update normal porque `location` es geography:
// habría que mandar EWKT en texto y confiar en el cast. La función de la base
// recibe dos números, los valida otra vez y arma el punto ella.
async function guardarUbicacion(supabase, id, punto) {
  if (punto.lat === null) return null;

  const { error } = await supabase.rpc("set_restaurant_location", {
    rid: id,
    lat: punto.lat,
    lng: punto.lng,
  });

  if (error) {
    console.error("guardar ubicacion", error.message);
    return { status: "error", message: "No pudimos guardar la ubicación." };
  }
  return null;
}

// Cuando el dueño no escribió coordenadas, se calculan desde su dirección.
// Nadie debería tener que copiar números de un mapa para salir en "Cerca de mí".
//
// Es "mejor esfuerzo" y no devuelve error a propósito: si Nominatim no contesta
// o no reconoce la dirección, la ficha se guarda igual y sale en las búsquedas
// por colonia y ciudad, solo que sin distancia. Decirle al dueño que su
// guardado falló, cuando sí se guardó, sería mentirle.
async function completarUbicacion(supabase, id, direccion, antes) {
  // Preguntar en cada guardado sería maltratar un servicio gratuito: si la
  // dirección no cambió y el punto ya está puesto, no hay nada que resolver.
  const yaTienePunto = Boolean(antes?.location);
  if (yaTienePunto && mismaDireccion(antes, direccion)) return;

  const calculado = await geocodificar(direccion);
  // Sin dirección reconocible no se borra un punto que ya existía: sería perder
  // un dato bueno por una consulta fallida.
  if (!calculado) return;

  const { error } = await supabase.rpc("set_restaurant_location", {
    rid: id,
    lat: calculado.lat,
    lng: calculado.lng,
  });

  if (error) console.error("guardar ubicacion calculada", error.message);
}

// Categorías y horarios se reescriben enteros en vez de calcular el diff: son
// pocas filas y así el estado guardado es exactamente lo que muestra el form.
async function guardarCategorias(supabase, id, formData) {
  const slugs = formData.getAll("cuisines").map(String).filter(Boolean);

  await supabase.from("restaurant_cuisines").delete().eq("restaurant_id", id);

  if (!slugs.length) return null;

  const { data: catalogo } = await supabase
    .from("cuisines")
    .select("id")
    .in("slug", slugs);

  if (!catalogo?.length) return null;

  const { error } = await supabase.from("restaurant_cuisines").insert(
    catalogo.map((c) => ({ restaurant_id: id, cuisine_id: c.id })),
  );

  if (error) {
    console.error("guardar categorias", error.message);
    return { status: "error", message: "No pudimos guardar las categorías." };
  }
  return null;
}

async function guardarHorarios(supabase, id, formData) {
  const filas = [];

  for (let dia = 0; dia < 7; dia += 1) {
    const abre = String(formData.get(`opens_${dia}`) ?? "").trim();
    const cierra = String(formData.get(`closes_${dia}`) ?? "").trim();
    // Un día sin horas es un día cerrado, no un error: es lo que hace el
    // dueño que solo abre de martes a domingo.
    if (!abre || !cierra) continue;
    filas.push({ restaurant_id: id, weekday: dia, opens: abre, closes: cierra });
  }

  await supabase.from("restaurant_hours").delete().eq("restaurant_id", id);

  if (!filas.length) return null;

  const { error } = await supabase.from("restaurant_hours").insert(filas);
  if (error) {
    console.error("guardar horarios", error.message);
    return { status: "error", message: "No pudimos guardar los horarios." };
  }
  return null;
}

export async function crearCategoria(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const { supabase, user, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) {
    return { status: "error", message: "Ese restaurante no es tuyo." };
  }

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (nombre.length < 3) {
    return { status: "error", message: "Escribe el nombre de la categoría." };
  }
  if (nombre.length > 40) {
    return { status: "error", message: "Usa un nombre más corto." };
  }

  const slug = aSlug(nombre);
  if (!slug) {
    return { status: "error", message: "Ese nombre no sirve como categoría." };
  }

  // Se busca antes de insertar en vez de usar upsert: bajo RLS un ON CONFLICT
  // necesita leer la fila en conflicto, y aquí basta con reutilizar la que ya
  // exista para que "BBQ" y "bbq" no se conviertan en dos categorías.
  const { data: existente } = await supabase
    .from("cuisines")
    .select("slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (existente) {
    return {
      status: "ok",
      message: `"${existente.name}" ya estaba en la lista. Márcala.`,
      slug: existente.slug,
    };
  }

  const { data: creada, error } = await supabase
    .from("cuisines")
    .insert({ slug, name: nombre, created_by: user.id })
    .select("slug, name")
    .single();

  if (error) {
    console.error("crear categoria", error.message);
    return { status: "error", message: "No pudimos crear la categoría." };
  }

  revalidatePath(`/panel/${id}`);
  return {
    status: "ok",
    message: `"${creada.name}" agregada. Ya puedes marcarla.`,
    slug: creada.slug,
  };
}

export async function subirFotos(_prevState, formData) {
  const id = String(formData.get("id") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) {
    return { status: "error", message: "Ese restaurante no es tuyo." };
  }

  const archivos = formData
    .getAll("fotos")
    .filter((f) => typeof f === "object" && f.size > 0);

  if (!archivos.length) {
    return { status: "error", message: "Elige al menos una foto." };
  }

  const { data: ultima } = await supabase
    .from("restaurant_media")
    .select("position")
    .eq("restaurant_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  let posicion = (ultima?.position ?? -1) + 1;

  for (const archivo of archivos) {
    if (!TIPOS_FOTO.includes(archivo.type)) {
      return { status: "error", message: "Solo JPG, PNG, WebP o AVIF." };
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      return { status: "error", message: "Cada foto debe pesar menos de 5 MB." };
    }

    // La primera carpeta de la ruta es el id del restaurante: de ahí saca el
    // permiso la política de Storage.
    const extension = archivo.type.split("/")[1].replace("jpeg", "jpg");
    const ruta = `${id}/${crypto.randomUUID()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

    if (errorSubida) {
      console.error("subir foto", errorSubida.message);
      return { status: "error", message: "No pudimos subir la foto." };
    }

    const { error: errorFila } = await supabase.from("restaurant_media").insert({
      restaurant_id: id,
      kind: "foto",
      storage_path: ruta,
      position: posicion,
    });

    if (errorFila) {
      console.error("registrar foto", errorFila.message);
      // El archivo sin fila sería basura invisible en el bucket.
      await supabase.storage.from(BUCKET_FOTOS).remove([ruta]);
      return { status: "error", message: "No pudimos guardar la foto." };
    }

    posicion += 1;
  }

  revalidatePath(`/panel/${id}`);
  return {
    status: "ok",
    message: archivos.length === 1 ? "Foto subida." : "Fotos subidas.",
  };
}

export async function borrarFoto(formData) {
  const id = String(formData.get("id") ?? "");
  const fotoId = String(formData.get("foto") ?? "");
  const { supabase, restaurante } = await sesionYRestaurante(id);
  if (!restaurante) return;

  const { data: foto } = await supabase
    .from("restaurant_media")
    .select("storage_path")
    .eq("id", fotoId)
    .eq("restaurant_id", id)
    .maybeSingle();

  if (!foto) return;

  await supabase.storage.from(BUCKET_FOTOS).remove([foto.storage_path]);
  await supabase.from("restaurant_media").delete().eq("id", fotoId);

  revalidatePath(`/panel/${id}`);
}
