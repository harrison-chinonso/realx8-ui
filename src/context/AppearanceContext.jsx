// No `// @refresh reset` needed — this file now only exports a React component.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { fetchPlatformName } from '../api/userApi';
import { FONT_CATALOGUE, fontStack } from '../config/fonts';
import { brightenForDark, readableOn, readableTextOn } from '../utils/colorUtils';
import { AppearanceContext } from './appearanceContextRef';
import useAuthStore from '../store/authStore';
import { preferredCompanyId, readTheme, saveTheme } from '../lib/themeCache';
import { appearanceCameWith, onSessionAppearance } from '../lib/sessionAppearance';
import { applyTabIcon } from '../lib/tabIcon';

const DEFAULTS = {
  app_name: '',
  app_logo: null,
  // The browser tab icon. Blank means the Realx8 mark — see lib/tabIcon.js.
  app_favicon: '',
  primary_color: '#1e3a8a',
  secondary_color: '#0f172a',
  dark_primary_color: null,
  dark_secondary_color: null,
  font_heading: 'Tomato Grotesk',
  font_body: 'Inter',
  font_ui: 'Inter',
  font_family: 'Inter',
  dark_mode: 'off',
  currency: 'NGN',
  template: 'launcher',
  // The module launcher. Blank means the built-in default for each — see
  // launcherPalette.js for the colours and ModuleLauncher for the words.
  accent_colors: '',
  launcher_banner_image: '',
  launcher_badge: '',
  app_tagline: '',
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function loadFont(name, idSuffix) {
  const entry = FONT_CATALOGUE.find((f) => f.name === name);
  if (!entry || !entry.url) return null;
  const id = `dynamic-font-${idSuffix}`;
  let link = document.getElementById(id);
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== entry.url) link.href = entry.url;
  return { id, url: entry.url };
}

function applyTheme({ primary_color, secondary_color, dark_primary_color, dark_secondary_color, font_heading, font_body, font_ui, font_family, dark_mode }) {
  const root = document.documentElement;
  const isDark = dark_mode === 'on';
  /*
   * Every variable written is also collected, so the result can be remembered
   * (themeCache) and replayed by the inline script in index.html on the next
   * load without any of the colour maths below.
   */
  const vars = {};
  const setVar = (name, value) => { vars[name] = value; root.style.setProperty(name, value); };

  const effectivePrimary = isDark
    ? (dark_primary_color || brightenForDark(primary_color))
    : primary_color;
  const effectiveSecondary = isDark
    ? (dark_secondary_color || brightenForDark(secondary_color))
    : secondary_color;

  if (effectivePrimary) {
    setVar('--primary', effectivePrimary);
    setVar('--primary-rgb', hexToRgb(effectivePrimary));
    // Text that goes ON a primary fill — dark on a pale brand colour, white on
    // a deep one — so a tenant's buttons stay legible whatever they pick.
    setVar('--primary-ink', readableTextOn(effectivePrimary));
  }

  const sec = effectiveSecondary || '#0f172a';
  setVar('--secondary', sec);
  setVar('--secondary-rgb', hexToRgb(sec));

  /*
   * Two derived forms, so the secondary colour can be used without every call
   * site re-deciding whether it is legible.
   *
   * --secondary-ink   text that goes ON a secondary fill.
   * --secondary-read  the secondary colour itself, safe to use AS text, a
   *                   border or an outline on the page background.
   *
   * The second is the one that matters. The default secondary is #0f172a and
   * passes untouched, which is why the app has got away with assuming it — the
   * Classic sidebar hard-codes white text over it to this day. A tenant who
   * picks a pale colour gets 1.6:1 and an invisible interface, and the fix
   * cannot be per component because the colour now appears in buttons, badges
   * and table headers across every screen.
   *
   * Derived once here, against the page background of the mode actually in
   * effect, rather than recomputed in each component.
   */
  const pageBg = isDark ? '#0b1220' : '#ffffff';
  setVar('--secondary-ink', readableTextOn(sec));
  setVar('--secondary-read', readableOn(sec, pageBg));

  const heading = font_heading || font_family || 'Tomato Grotesk';
  const body    = font_body    || font_family || 'Inter';
  const ui      = font_ui      || font_family || 'Inter';

  setVar('--font-heading', fontStack(heading));
  setVar('--font-body',    fontStack(body));
  setVar('--font-ui',      fontStack(ui));

  const fonts = [
    loadFont(heading, 'heading'),
    loadFont(body,    'body'),
    ui !== body ? loadFont(ui, 'ui') : null,
  ].filter(Boolean);

  if (dark_mode === 'on') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  return { vars, fonts, dark: isDark };
}

/** The company whose appearance a request made NOW would return. */
const scopeNow = () => {
  const state = useAuthStore.getState();
  return state.accessToken ? (state.user?.company_id ?? state.company_id ?? null) : null;
};

export function AppearanceProvider({ children }) {
  // nameLoaded: true once the lightweight platform-name call returns
  // fullyLoaded: true once the full appearance call returns
  /*
   * Start from the theme this device last showed this company, when there is
   * one — the inline script in index.html has already painted its colours, so
   * React's first render agrees with them (name, logo, template) instead of
   * starting from the platform defaults and repainting.
   */
  const [initialTheme] = useState(() => readTheme(preferredCompanyId()));
  const [appearance, setAppearance] = useState(() => (initialTheme?.appearance ? { ...DEFAULTS, ...initialTheme.appearance } : DEFAULTS));
  const [nameLoaded, setNameLoaded] = useState(Boolean(initialTheme?.appearance?.app_name));

  /**
   * Set once a shared link has branded the page for a specific company.
   *
   * The two background loads below fetch *platform* defaults and resolve in an
   * order nobody controls, so without this they could repaint over the
   * company's colours a moment after the prospect sees them. The link wins.
   */
  const brandLocked = useRef(false);

  /**
   * Which appearance load is the current one.
   *
   * Two fetches are in flight at any interesting moment — the unauthenticated
   * one from mount, and the authenticated one that follows a sign-in — and they
   * resolve in whatever order the network decides. Without a sequence the
   * SLOWER one wins, so a user from a branded company would sign in, see their
   * colours appear, and watch the platform defaults paint over them a moment
   * later. That is the bug this counter exists for: a response is applied only
   * if no newer request has been started since.
   */
  const loadSeq = useRef(0);

  /**
   * The newest sequence whose FULL appearance load has already been applied.
   *
   * The sequence above settles races BETWEEN passes; this settles the race
   * WITHIN one. A pass fires two requests that share a sequence — the public
   * name/logo call and the authenticated appearance call — and whichever
   * returns last wins. When the authenticated one returns first, the public
   * reply lands on top of it moments later and puts the PLATFORM's name, logo
   * and primary colour back over the company's. That is what a company user
   * sees as their branding reverting to the defaults a beat after the page
   * loads, on every reload.
   *
   * The full load is the more specific answer — it already carries the platform
   * values for anything the company has not set, because the server merges the
   * two tiers before replying. So once it has been applied for a pass, the fast
   * call from that same pass has nothing left to contribute.
   */
  const fullApplied = useRef(0);

  const load = (data, { seq, force = false, companyId, remember = true } = {}) => {
    // A response from a superseded request describes a state we have moved on
    // from. Dropping it is the whole point.
    if (seq !== undefined && seq !== loadSeq.current) return;
    if (brandLocked.current && !force) return;
    const merged = { ...DEFAULTS, ...data };
    setAppearance(merged);
    const applied = applyTheme(merged);
    if (merged.app_name) document.title = merged.app_name;
    applyTabIcon(merged.app_favicon);
    if (seq !== undefined) fullApplied.current = seq;
    setNameLoaded(true);
    if (remember && companyId !== undefined) {
      saveTheme(companyId, {
        vars: applied.vars, fonts: applied.fonts, dark: applied.dark, title: merged.app_name || '', appearance: data,
      });
    }
  };

  /**
   * Apply the branding carried by a sealed share link, for visitors who have no
   * account and so no company of their own.
   */
  const applyBrand = useCallback((branding) => {
    if (!branding) return;
    brandLocked.current = true;
    setAppearance((prev) => {
      const merged = { ...prev, ...branding };
      applyTheme(merged);
      if (merged.app_name) document.title = merged.app_name;
      applyTabIcon(merged.app_favicon);
      return merged;
    });
    setNameLoaded(true);
  }, []);

  useEffect(() => {
    const seq = (loadSeq.current += 1);
    const companyId = scopeNow();
    // The remembered theme, through the same path as a fresh one, so the
    // derived state (fullApplied, the title) is set before any request returns.
    if (initialTheme?.appearance) load(initialTheme.appearance, { seq, companyId, remember: false });

    /*
     * 1️⃣ Fast call: the PLATFORM's name, logo and colour, for a visitor with
     * no session. Skipped when somebody is signed in: for them it could only
     * ever paint the platform's colour over their company's for a moment
     * before the full load corrected it — the flash this file exists to stop.
     */
    const signedOut = !useAuthStore.getState().accessToken;
    /*
     * Signed out, but painted in a remembered company's colours (the account
     * this device keeps — see knownAccount.js). The platform defaults must not
     * repaint over that; the sign-in page confirms the company's look itself,
     * and "Not you?" asks for the platform's again.
     */
    if (signedOut && initialTheme && preferredCompanyId() !== null) {
      setNameLoaded(true);
      return;
    }
    const fastCall = companyId === null && signedOut
      ? fetchPlatformName()
      : Promise.resolve({});
    fastCall
      .then(({ name, logo, primary_color }) => {
        if (seq !== loadSeq.current) { setNameLoaded(true); return; }
        if (brandLocked.current) { setNameLoaded(true); return; }
        // The full load for this pass beat us to it — it knows more than we do.
        if (fullApplied.current >= seq) { setNameLoaded(true); return; }
        setAppearance((prev) => ({ ...prev, app_name: name || prev.app_name, app_logo: logo || prev.app_logo }));
        if (name) document.title = name;
        if (primary_color) {
          document.documentElement.style.setProperty('--primary', primary_color);
          document.documentElement.style.setProperty('--primary-rgb', hexToRgb(primary_color));
        }
        setNameLoaded(true);
      })
      .catch(() => setNameLoaded(true)); // still mark loaded so UI doesn't stay in placeholder forever

    // 2️⃣ Full appearance load (fonts, colors, dark mode, etc.) — runs in parallel
    client.get('/settings/appearance')
      .then((res) => load(res.data?.data || {}, { seq, companyId }))
      .catch(() => { if (!brandLocked.current && seq === loadSeq.current && !initialTheme) applyTheme(DEFAULTS); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Re-read the appearance, as whoever is signed in NOW.
   *
   * `force` overrides brandLocked, and that is deliberate: the lock exists so a
   * shared link's branding is not repainted by the platform defaults loading
   * behind it, which is right for a prospect with no account. Once somebody
   * signs in, their own company's configuration is the more specific answer and
   * has to win — otherwise a realtor who followed a colleague's share link and
   * then logged in would keep wearing the wrong company's colours for the rest
   * of the session.
   */
  const refresh = useCallback(() => {
    const seq = (loadSeq.current += 1);
    const companyId = scopeNow();
    const signedIn = Boolean(useAuthStore.getState().accessToken);
    if (signedIn) brandLocked.current = false;
    // Paint what this device last saw for this company straight away; the
    // request below confirms or corrects it.
    const remembered = readTheme(companyId);
    /*
     * Forced only when somebody is signed in. Signed out, the answer is the
     * platform's defaults, and a page that has since branded
     * itself for a company — the sign-in page for a remembered account, or
     * /login/<code> — must keep that brand rather than lose it to this reply.
     */
    const force = signedIn;
    if (remembered?.appearance) load(remembered.appearance, { seq, force, companyId, remember: false });
    return client.get('/settings/appearance')
      .then((res) => load(res.data?.data || {}, { seq, force, companyId }))
      .catch(() => {});
     
  }, []);

  /*
   * Branding that arrived with the session itself — the login, registration,
   * refresh or profile-switch response. Applied the moment the response is
   * read, before the new token is even stored, so the first screen after
   * sign-in is already in the company's colours.
   */
  useEffect(() => onSessionAppearance((data, companyId) => {
    const seq = (loadSeq.current += 1);
    brandLocked.current = false;
    load(data, { seq, force: true, companyId });
     
  }), []);

  /**
   * Whoever is signed in decides what the application looks like — so the
   * appearance is re-read whenever that changes.
   *
   * Driven from the session rather than from the login screen. There are five
   * ways into a session (password, two-factor, forced enrolment, passcode,
   * Google) and two that change WHICH company is in scope (switching profile,
   * enabling a second one), and a refresh call at each is a list somebody
   * eventually adds to without noticing. Watching the token and the company is
   * one rule that covers all of them, including the next one.
   *
   * `company_id` is in the key because a platform administrator moving between
   * companies keeps the same token while the branding that applies changes.
   */
  const accessToken = useAuthStore((state) => state.accessToken);
  const companyId = useAuthStore((state) => state.user?.company_id ?? null);
  const firstRun = useRef(true);

  useEffect(() => {
    // The mount-time load above already covers the first pass; refreshing again
    // here would be a second identical request on every page load.
    if (firstRun.current) { firstRun.current = false; return; }
    // The session that brought this token also brought its appearance.
    if (appearanceCameWith(accessToken)) return;
    refresh();
  }, [accessToken, companyId, refresh]);

  /**
   * Money display: thousands-separated with the company's currency SIGN
   * (₦25,000,000). narrowSymbol prefers the short sign and falls back to the
   * ISO code for currencies that have none (e.g. KES).
   */
  const formatCurrency = useCallback((amount) => {
    const code = appearance.currency || 'NGN';
    const value = Number(amount);
    const safe = Number.isFinite(value) ? value : 0;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(safe);
    } catch {
      // Unknown/invalid code — still comma-separate and label it.
      return `${code} ${safe.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
  }, [appearance.currency]);

  /** Just the sign (₦, $, £) for input adornments and spreadsheet formats. */
  const currencySymbol = useMemo(() => {
    const code = appearance.currency || 'NGN';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value || code;
    } catch {
      return code;
    }
  }, [appearance.currency]);

  return (
    <AppearanceContext.Provider value={{ ...appearance, nameLoaded, refresh, formatCurrency, currencySymbol, applyBrand }}>
      {children}
    </AppearanceContext.Provider>
  );
}

// Hooks live in useAppearance.js to keep this file Fast Refresh compatible
// (Vite requires .jsx files to only export React components)
