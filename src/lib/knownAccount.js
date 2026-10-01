/**
 * The account last signed in on this device, when its owner asked to be
 * kept signed in — so the sign-in page can greet them by name, in their
 * company's colours, with only the password left to type.
 *
 * Only what the greeting needs: name, email (to sign in with; shown masked),
 * type, and the company's name and code. No token, no id beyond the company.
 * Written after a sign-in (which first clears everything else in storage) and
 * forgotten on "Not you?" or when "Keep me signed in" is unticked. Signing out
 * leaves it, which is the point: it is the next sign-in it serves.
 */

const KEY = 'rx-known-account';

export const readKnownAccount = () => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    return value?.email ? value : null;
  } catch {
    return null;
  }
};

/**
 * How long after a full sign-in the passcode is accepted. Mirrors the server's
 * PASSCODE_WINDOW_HOURS (passcodeController.js), which is the authority — this
 * copy only decides which form to show first.
 */
export const PASSCODE_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * `passwordAt` — when this device last signed in IN FULL (password, two-factor,
 * Google). A passcode sign-in passes the previous value through untouched, the
 * same way the server leaves its own clock alone for one, so the device and
 * the server agree on when the window closes.
 */
export const rememberAccount = (session, { passwordAt = Date.now() } = {}) => {
  const user = session?.user;
  if (!user?.email) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      passcode_set: Boolean(user.passcode_set),
      password_at: passwordAt || null,
      name: user.name || '',
      email: user.email,
      type: user.effectiveType || user.type || '',
      company_id: session.company?.id ?? null,
      company_name: session.company?.name || null,
      company_code: session.company?.code || null,
    }));
  } catch { /* storage unavailable — the page simply will not greet them */ }
};

/** Update the remembered account in place — after setting or removing a passcode. */
export const updateKnownAccount = (email, patch) => {
  const known = readKnownAccount();
  if (!known || String(known.email).toLowerCase() !== String(email || '').toLowerCase()) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...known, ...patch })); } catch { /* storage unavailable */ }
};

/**
 * Whether to open the sign-in page on the passcode: the account has one, and
 * this device signed in in full within the window. The server still decides —
 * if it says the window has closed, the password form comes back.
 */
export const passcodeLikelyOpen = (known) => Boolean(known?.passcode_set && known?.password_at)
  && Date.now() - Number(known.password_at) < PASSCODE_WINDOW_MS;

export const forgetAccount = () => {
  try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
};

/** a•••@example.com — enough to recognise, not enough to read off a shoulder. */
export const maskEmail = (email = '') => {
  const [local, domain] = String(email).split('@');
  if (!domain) return email;
  return `${local.slice(0, Math.min(2, local.length))}•••@${domain}`;
};

export const initialsOf = (name = '') => String(name).trim().split(/\s+/).slice(0, 2)
  .map((part) => part[0]?.toUpperCase() || '').join('') || '?';
