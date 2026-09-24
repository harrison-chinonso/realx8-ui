/**
 * Wipe everything this browser is still holding from a previous session.
 *
 * ── Why a sign-in is the right moment ───────────────────────────────────────
 *
 * Browser storage on this origin is per-BROWSER, not per-user, and several
 * things live there that read as personal: the launcher's recent screens, the
 * properties list's grid-or-list choice, where the assistant widget was last
 * dragged to. Sign out on a shared machine and the next person to sign in
 * inherits all of it — and, more confusingly, inherits it silently, because
 * each of those values is a small preference nobody thinks to go and check.
 *
 * Clearing at sign-in rather than at sign-out is deliberate: a sign-out can be
 * a closed tab, a killed browser or an expired token, and none of those run our
 * code. A sign-in always does.
 *
 * ── What this can and cannot reach ──────────────────────────────────────────
 *
 * localStorage, sessionStorage and the Cache Storage a service worker writes
 * to — all of it, not a list of known keys, so a value added later is covered
 * without anybody remembering to add it here.
 *
 * It CANNOT clear the browser's HTTP cache; no page is allowed to. Responses
 * already cached stay cached until they expire on their own, which in practice
 * means the one short-lived public response the app serves (the platform name
 * and logo, sixty seconds). Anything that must not be reused across sessions
 * has to say so in its own Cache-Control header — this function is not a
 * substitute for that.
 *
 * The service worker itself is left registered. Unregistering it would drop the
 * push subscription with it, signing the user out of notifications every time
 * they sign in, which is not what clearing a cache is meant to cost.
 */
export const clearBrowserState = () => {
  try { localStorage.clear(); } catch { /* private mode, or no storage */ }
  try { sessionStorage.clear(); } catch { /* ditto */ }

  // Fire-and-forget: a sign-in must not wait on the cache, and a browser that
  // refuses the call is not a reason to fail the sign-in.
  try {
    if (typeof caches !== 'undefined') {
      caches.keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .catch(() => {});
    }
  } catch { /* no Cache Storage here */ }
};

export default clearBrowserState;
