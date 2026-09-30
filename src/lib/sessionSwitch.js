/**
 * Where somebody lands after changing WHO they are acting as — another
 * profile (realtor ⇄ client) or another company.
 *
 * Always the dashboard, and always with a full page load. The page they were
 * on belongs to the identity they just left: an invoice, a client, a
 * commission, a property from the other company or the other profile. Reloading
 * it in place either shows that record under the new name or fails on it, and
 * both read as the switch having gone wrong. The dashboard exists for every
 * profile, and a full load re-fetches every list, count and badge as the new
 * account — the company's colours included, which the switch has already
 * saved for this device (see AppearanceContext and themeCache).
 */
export const landOnDashboard = () => {
  window.location.assign('/');
};

/** Who a persisted session is acting as — enough to tell a switch from a token refresh. */
const identityOf = (state) => (state?.accessToken
  ? `${state.user?.id ?? ''}|${state.company_id ?? state.user?.company_id ?? ''}|${state.activeRole?.id ?? ''}`
  : 'signed-out');

/**
 * Keeps other open tabs honest.
 *
 * The session is shared through localStorage, so a switch or a sign-in to a
 * different company in one tab changes the account every other tab's next
 * request is made as — while those tabs still show the old company's screens.
 * When another tab changes who is signed in, this tab follows: to the
 * dashboard as the new account, or to the sign-in page if they signed out. A
 * silent token refresh changes only the token, not the identity, and is left
 * alone.
 */
export const followSessionAcrossTabs = (getState) => {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key !== 'realto-auth') return;
    let next = null;
    try { next = JSON.parse(event.newValue || 'null')?.state ?? null; } catch { next = null; }
    const current = getState();
    if (identityOf(next) === identityOf(current)) return;
    // Signed out here already and still signed out there: nothing to follow.
    if (!next?.accessToken && !current.accessToken) return;
    window.location.assign(next?.accessToken ? '/' : '/login');
  });
};
