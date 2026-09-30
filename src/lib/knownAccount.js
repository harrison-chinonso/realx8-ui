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

export const rememberAccount = (session) => {
  const user = session?.user;
  if (!user?.email) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      name: user.name || '',
      email: user.email,
      type: user.effectiveType || user.type || '',
      company_id: session.company?.id ?? null,
      company_name: session.company?.name || null,
      company_code: session.company?.code || null,
    }));
  } catch { /* storage unavailable — the page simply will not greet them */ }
};

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
