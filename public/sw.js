/*
 * ── Deployment note: this file must be served AS ITSELF ────────────────────
 *
 * vercel.json rewrites everything to index.html for client-side routing, with
 * an exception list that names this file. Remove it from that list and the
 * worker is served as HTML, the browser refuses to register a script with the
 * wrong MIME type, and browser notifications fail in production while working
 * perfectly in development — where Vite serves the file directly and no
 * rewrite exists.
 *
 * It must also stay at the root. A service worker may only control the scope
 * it is served from, so moving it under /assets would silently narrow what it
 * can reach.
 *
 * (The explanation lives here rather than in vercel.json, which is validated
 * against a schema that rejects any property it does not recognise — including
 * a comment.)
 */

/* eslint-env serviceworker */

/**
 * The service worker that shows a browser notification.
 *
 * ── Why any of this has to exist ────────────────────────────────────────────
 *
 * A push message arrives when the application is NOT running — that is the
 * whole point of it. There is no React tree to receive it and no tab that
 * necessarily exists. The browser wakes this worker instead, hands it the
 * payload, and gives it a few seconds to do something.
 *
 * ── Showing something is not optional ───────────────────────────────────────
 *
 * Receiving a push and displaying nothing is not allowed: browsers permit a
 * small number of silent pushes and then revoke the permission outright. So
 * every branch below ends in showNotification, including the one where the
 * payload could not be read.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A payload that will not parse still has to produce a notification, or the
    // browser counts it as a silent push against us. Better a vague one than a
    // revoked permission.
    payload = { title: 'Notification', body: 'You have an update.' };
  }

  const title = payload.title || 'Notification';
  const options = {
    body: payload.body || '',
    /*
     * `tag` lets a new notification REPLACE an earlier one about the same
     * thing rather than stacking four copies of "payment approved" on a lock
     * screen. `renotify` makes the replacement still alert, so a genuine
     * update is not silently swapped in behind the old one.
     */
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/', ...(payload.data || {}) },
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Clicking a notification.
 *
 * An open tab is focused and navigated rather than a new one opened: somebody
 * who leaves the application open all day and clicks three notifications should
 * not end up with three more tabs of the same site.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ('navigate' in client && target) await client.navigate(target).catch(() => {});
        return;
      }
    }

    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

/**
 * A subscription the push service has rotated.
 *
 * Browsers reissue one occasionally, and until the server is told, every
 * notification goes to an endpoint that no longer exists. The application
 * re-subscribes on its next load anyway; this is the belt to that braces.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const subscription = await self.registration.pushManager.subscribe(
        event.oldSubscription?.options || { userVisibleOnly: true },
      );
      await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
        credentials: 'include',
      });
    } catch {
      // Nothing useful to do from here — the next page load re-subscribes.
    }
  })());
});

/** Take over as soon as installed, so a first-time subscribe works at once. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
