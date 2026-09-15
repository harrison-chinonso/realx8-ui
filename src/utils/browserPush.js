import { pushPublicKey, pushSubscribe, pushUnsubscribe } from '../api/pushApi';

/**
 * Turning browser notifications on and off.
 *
 * ── The three states, which are not two ─────────────────────────────────────
 *
 * Permission is `default`, `granted` or `denied`, and the third is the one that
 * matters. A browser that has been told "block" will never show the prompt
 * again, however many times the application asks — so a button that says "turn
 * on notifications" is a lie there. The state has to be reported, not merely
 * acted on.
 *
 * ── Why the prompt is never shown unprompted ────────────────────────────────
 *
 * Asking on page load is how sites get blocked permanently: somebody who has
 * not decided they want notifications says no, and no is final. It is only
 * requested from an explicit control, which is also what Chrome's own
 * heuristics reward.
 */

/** Whether this browser can do push at all. Old ones, and Safari before 16.4. */
export const pushSupported = () => (
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window
);

/**
 * What the browser currently thinks, without asking it anything.
 *
 * @returns {'unsupported'|'insecure'|'default'|'granted'|'denied'}
 */
export const pushPermission = () => {
  if (!pushSupported()) return 'unsupported';
  /*
   * Service workers need a secure context. localhost counts as one, which is
   * why this works in development over plain http and then fails on a staging
   * host served the same way — worth reporting distinctly rather than as
   * "unsupported", because the fix is a certificate, not a browser.
   */
  if (!window.isSecureContext) return 'insecure';
  return Notification.permission;
};

/** The VAPID public key, as the byte array subscribe() wants. */
const decodeKey = (base64) => {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** Register the worker, or reuse the registration if it is already there. */
export const ensureServiceWorker = async () => {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    // Most often the worker was served as HTML by an SPA rewrite — see
    // vercel.json, where /sw.js is deliberately excluded.
    console.error('[push] service worker did not register:', error.message);
    return null;
  }
};

/**
 * Turn browser notifications on for this browser.
 *
 * @returns {Promise<{ ok, state, message }>} — never throws.
 */
export const enablePush = async () => {
  const state = pushPermission();
  if (state === 'unsupported') {
    return { ok: false, state, message: 'This browser cannot show push notifications.' };
  }
  if (state === 'insecure') {
    return {
      ok: false,
      state,
      message: 'Browser notifications need a secure (https) connection.',
    };
  }
  if (state === 'denied') {
    return {
      ok: false,
      state,
      /*
       * Named as a browser setting, because that is the only place it can be
       * undone. "Try again" would be advice that cannot work.
       */
      message: 'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.',
    };
  }

  const granted = state === 'granted' || (await Notification.requestPermission()) === 'granted';
  if (!granted) {
    return { ok: false, state: Notification.permission, message: 'Notifications were not allowed.' };
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    return { ok: false, state: 'error', message: 'The notification worker could not start.' };
  }

  let key;
  try {
    key = (await pushPublicKey())?.publicKey;
  } catch {
    key = null;
  }
  if (!key) {
    return {
      ok: false,
      state: 'unavailable',
      message: 'Browser notifications are not set up on this server yet.',
    };
  }

  try {
    /*
     * An existing subscription is reused rather than replaced. Unsubscribing
     * and re-subscribing issues a NEW endpoint, which would leave the old row
     * on the server sending to an address the browser has stopped listening on.
     */
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      // Required by every browser: a push must result in something visible.
      userVisibleOnly: true,
      applicationServerKey: decodeKey(key),
    });

    await pushSubscribe(subscription.toJSON());
    return { ok: true, state: 'granted', message: 'Browser notifications are on.' };
  } catch (error) {
    console.error('[push] subscribe failed:', error);
    return { ok: false, state: 'error', message: 'This browser could not be registered for notifications.' };
  }
};

/** Turn them off for this browser, on the server and in the browser itself. */
export const disablePush = async () => {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return { ok: true, message: 'Browser notifications are off.' };

    /*
     * The server first. If the browser unsubscribes and the server call then
     * fails, the row is left pointing at a dead endpoint and every future
     * notification counts a failure against it.
     */
    await pushUnsubscribe(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
    return { ok: true, message: 'Browser notifications are off.' };
  } catch (error) {
    return { ok: false, message: 'Could not turn them off. Try again.' };
  }
};

/**
 * Whether THIS browser is currently subscribed.
 *
 * Asked of the browser rather than the server: the server knows which
 * subscriptions exist, but not which of them is the one in front of you.
 */
export const isSubscribedHere = async () => {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(await registration?.pushManager.getSubscription());
  } catch {
    return false;
  }
};
