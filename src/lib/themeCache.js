/**
 * The last theme each company was shown in, remembered on this device.
 *
 * Without it every page load started in the platform's navy and repainted in
 * the company's colours once two requests had come back — the flash people
 * read as "the branding takes a while". With it, the inline script in
 * index.html paints the remembered theme before the bundle has even loaded,
 * and the network only confirms it (or corrects it, if an admin changed it).
 *
 * What is stored is the RESULT — the CSS variables applyTheme wrote, the font
 * stylesheets, the dark flag, the title — so the inline script needs none of
 * the colour maths, and the appearance object itself so React's first render
 * has the right name and logo too.
 *
 * Keyed by company, so a device shared between two companies' people, or a
 * platform admin moving between tenants, never paints one company's colours
 * over another. Keep the key and shape in step with the script in index.html.
 */

const PREFIX = 'rx-theme:';
const VERSION = 1;

export const themeKeyFor = (companyId) => `${PREFIX}${companyId ?? 'platform'}`;

/** The company the persisted session belongs to, read without the store (no import cycle). */
export const persistedCompanyId = () => {
  try {
    const raw = localStorage.getItem('realto-auth');
    const state = raw ? JSON.parse(raw)?.state : null;
    return state?.accessToken ? (state.company_id ?? state.user?.company_id ?? null) : null;
  } catch {
    return null;
  }
};

/**
 * The company a signed-OUT visitor on this device most likely belongs to: the
 * one the remembered account (lib/knownAccount.js) signed in to. Lets the
 * sign-in page greet them in their company's colours from the first paint,
 * instead of the platform's.
 */
export const rememberedCompanyId = () => {
  try {
    const known = JSON.parse(localStorage.getItem('rx-known-account') || 'null');
    return known?.company_id ?? null;
  } catch {
    return null;
  }
};

/** Whose theme to paint first: the live session's company, else the remembered one. */
export const preferredCompanyId = () => persistedCompanyId() ?? rememberedCompanyId();

export const readTheme = (companyId) => {
  try {
    const raw = localStorage.getItem(themeKeyFor(companyId));
    const theme = raw ? JSON.parse(raw) : null;
    return theme?.v === VERSION ? theme : null;
  } catch {
    return null;
  }
};

export const saveTheme = (companyId, theme) => {
  try {
    localStorage.setItem(themeKeyFor(companyId), JSON.stringify({ ...theme, v: VERSION }));
  } catch { /* private mode or full storage — the theme still applies, it is just not remembered */ }
};

/**
 * The company a page is FOR, from its address: /login/<code>, /c/<code>, or
 * ?company_code= / ?code=. Such a page is that company's front door, so it is
 * painted in that company's colours from the first frame — never the platform's
 * on the way there. Null on every other page.
 */
export const companyCodeFromUrl = (location = typeof window !== 'undefined' ? window.location : null) => {
  if (!location) return null;
  const path = /^\/(?:login|c)\/([A-Za-z0-9-]{3,16})\/?$/.exec(location.pathname || '');
  const query = new URLSearchParams(location.search || '');
  const code = (path && path[1]) || query.get('company_code') || query.get('code');
  return code ? String(code).trim().toUpperCase() : null;
};

/** A company's look, remembered by its code — what the index.html script paints first on its page. */
export const readCodeTheme = (code) => (code ? readTheme(`code:${code}`) : null);
export const saveCodeTheme = (code, theme) => { if (code) saveTheme(`code:${code}`, theme); };
