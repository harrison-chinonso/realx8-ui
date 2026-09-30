/**
 * Branding that arrived WITH a session (login, registration, token refresh,
 * profile switch), handed from the auth store to the AppearanceProvider.
 *
 * The store is plain zustand and cannot reach React context, and the provider
 * cannot see a response the store consumed — so this is the seam. The store
 * publishes before it commits the new token; the provider applies at once and
 * remembers which token the appearance came with, so the "token changed,
 * re-read the appearance" effect knows it has nothing to fetch.
 */

let listener = null;
let lastToken = null;

export const publishSessionAppearance = (appearance, { accessToken, companyId }) => {
  if (!appearance || typeof appearance !== 'object') return;
  lastToken = accessToken || null;
  listener?.(appearance, companyId ?? null);
};

export const onSessionAppearance = (fn) => {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
};

/** True when this token's appearance was already applied from its session payload. */
export const appearanceCameWith = (accessToken) => Boolean(accessToken) && accessToken === lastToken;
