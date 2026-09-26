/**
 * Whether the promotion advert has been closed for this session.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 *
 * Close it once and it stays closed until the next sign-in. Not until the next
 * page, and not for ever — an advert that returns on every navigation is the
 * reason people stop reading adverts, and one dismissed permanently can never
 * mention next month's campaign.
 *
 * ── Why sessionStorage, and why login clears it ─────────────────────────────
 *
 * sessionStorage is per-tab and survives a reload but not a closed tab, which
 * is almost the right lifetime already: dismissing the advert then refreshing
 * must not bring it back. What it does not do on its own is reset when somebody
 * signs out and in again — the tab is the same tab. So `clearAdvertDismissals`
 * runs from the auth store when a session begins, which is the one moment the
 * rule says it should reappear.
 *
 * Deliberately NOT in the auth store: that store persists to localStorage, so a
 * flag living there would outlive the session it is scoped to. Same reasoning
 * as launcherGreeting, whose shape this follows.
 */

const KEY = (surface) => `rx:advert-dismissed:${surface}`;

/** The two places the advert appears; dismissed independently. */
export const ADVERT_SURFACES = { MODAL: 'modal', CAROUSEL: 'carousel' };

export const isAdvertDismissed = (surface) => {
  try {
    return sessionStorage.getItem(KEY(surface)) === '1';
  } catch {
    // Private mode, or storage blocked. Showing the advert is the harmless
    // direction to fail in — it is still closable, just not remembered.
    return false;
  }
};

export const dismissAdvert = (surface) => {
  try { sessionStorage.setItem(KEY(surface), '1'); } catch { /* no storage */ }
};

/** Called when a session begins, so the next sign-in shows the advert again. */
export const clearAdvertDismissals = () => {
  try {
    Object.values(ADVERT_SURFACES).forEach((surface) => sessionStorage.removeItem(KEY(surface)));
  } catch { /* no storage */ }
};
