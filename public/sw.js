// El service worker de Menú Abierto.
//
// Hace dos cosas y nada más: recibe los avisos por push y los enseña como
// notificación, y guarda una página para cuando no hay conexión. No cachea
// las fichas ni las cartas: los precios cambian y una carta vieja servida
// desde caché sería peor que un "sin conexión" honesto.

const CACHE = "menuabierto-v1";
const SIN_CONEXION = "/sin-conexion";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([SIN_CONEXION, "/iconos/icono-192.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((llaves) => Promise.all(llaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Solo las navegaciones: si la red falla, la página de sin conexión. Todo lo
// demás (imágenes, datos) va directo a la red.
self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(SIN_CONEXION).then((r) => r || Response.error())),
  );
});

self.addEventListener("push", (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { titulo: "Menú Abierto", cuerpo: evento.data ? evento.data.text() : "" };
  }
  const titulo = datos.titulo || "Menú Abierto";
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "",
      icon: "/iconos/icono-192.png",
      badge: "/iconos/badge-96.png",
      tag: datos.tag || undefined,
      renotify: false,
      data: { url: datos.url || "/avisos" },
    }),
  );
});

// Tocar la notificación abre lo que anuncia: la ficha, la reseña, la
// insignia. Si la app ya está abierta, se reusa esa ventana.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = evento.notification.data?.url || "/avisos";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) {
          v.navigate(url);
          return v.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
