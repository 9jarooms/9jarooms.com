// 9jaRooms phone notifications: shows a notification even when the app is closed, and opens the
// app on tap. Kept tiny on purpose (no caching: the app always loads fresh).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
    event.waitUntil(self.registration.showNotification(d.title || '9jaRooms', {
        body: d.body || '',
        icon: '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        tag: d.tag || undefined,
        renotify: !!d.tag,
        vibrate: [120, 60, 120],
        data: { url: d.url || '/dashboard' },
    }));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/dashboard';
    event.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of all) { if ('focus' in c) { await c.focus(); if ('navigate' in c) c.navigate(url).catch(() => {}); return; } }
        await self.clients.openWindow(url);
    })());
});
