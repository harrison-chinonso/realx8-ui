/**
 * A one-shot marker saying "a session just began".
 *
 * ── Why this is not simply `useState(true)` ─────────────────────────────────
 *
 * The launcher template opens its menu on arrival, which should mean ON LOGIN
 * and not on every mount. Signing in does not reload the page — LoginPage calls
 * navigate('/') — so the layout mounting is very nearly the right moment, but
 * not quite: it also mounts when somebody refreshes a page they were already
 * working on, and having the menu cover their screen every time they hit F5
 * would make the template unusable.
 *
 * ── Why sessionStorage, and why it is consumed ──────────────────────────────
 *
 * It has to survive a navigation but not a reload, and be gone once it has been
 * acted on. sessionStorage read-and-delete gives exactly that: the flag is
 * written when a session starts, spent by the first layout that sees it, and a
 * refresh five minutes later finds nothing. It is per-tab, which is also right
 * — signing in on one tab should not open the menu on another.
 *
 * Deliberately NOT part of the auth store: that store is persisted to
 * localStorage, so a flag living there would outlive the reload it exists to
 * distinguish from a login.
 */
const KEY = 'rx:launcher-greeting';

/** Called when a session begins. Safe where storage is unavailable. */
export const markFreshLogin = () => {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode, or no storage */ }
};

/** True once per login, false every time after. */
export const consumeFreshLogin = () => {
  try {
    if (!sessionStorage.getItem(KEY)) return false;
    sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
};
