self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "SkipperNow";
  const body = data.body || "Vous avez reçu un nouveau message.";
  const url = data.url || "https://skippernow.fr";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/skippernow-icon.svg",
      badge: "/skippernow-icon.svg",
      data: { url }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "https://skippernow.fr";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) { client.navigate(url); return client.focus(); }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
