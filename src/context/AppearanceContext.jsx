// No `// @refresh reset` needed — this file now only exports a React component.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import { fetchPlatformName } from '../api/userApi';
import { FONT_CATALOGUE, fontStack } from '../config/fonts';
import { brightenForDark } from '../utils/colorUtils';
import { AppearanceContext } from './appearanceContextRef';
import useAuthStore from '../store/authStore';

const DEFAULTS = {
  app_name: '',
  app_logo: null,
  primary_color: '#1e3a8a',
  secondary_color: '#0f172a',
  dark_primary_color: null,
  dark_secondary_color: null,
  font_heading: 'Tomato Grotesk',
  font_body: 'Inter',
  font_ui: 'Inter',
  font_family: 'Inter',
  dark_mode: 'off',
  currency: 'USD',
  template: 'classic',
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function loadFont(name, idSuffix) {
  const entry = FONT_CATALOGUE.find((f) => f.name === name);
  if (!entry || !entry.url) return;
  const id = `dynamic-font-${idSuffix}`;
  let link = document.getElementById(id);
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== entry.url) link.href = entry.url;
}

function applyTheme({ primary_color, secondary_color, dark_primary_color, dark_secondary_color, font_heading, font_body, font_ui, font_family, dark_mode }) {
  const root = document.documentElement;
  const isDark = dark_mode === 'on';

  const effectivePrimary = isDark
    ? (dark_primary_color || brightenForDark(primary_color))
    : primary_color;
  const effectiveSecondary = isDark
    ? (dark_secondary_color || brightenForDark(secondary_color))
    : secondary_color;

  if (effectivePrimary) {
    root.style.setProperty('--primary', effectivePrimary);
    root.style.setProperty('--primary-rgb', hexToRgb(effectivePrimary));
  }

  const sec = effectiveSecondary || '#0f172a';
  root.style.setProperty('--secondary', sec);
  root.style.setProperty('--secondary-rgb', hexToRgb(sec));

  const heading = font_heading || font_family || 'Tomato Grotesk';
  const body    = font_body    || font_family || 'Inter';
  const ui      = font_ui      || font_family || 'Inter';

  root.style.setProperty('--font-heading', fontStack(heading));
  root.style.setProperty('--font-body',    fontStack(body));
  root.style.setProperty('--font-ui',      fontStack(ui));

  loadFont(heading, 'heading');
  loadFont(body,    'body');
  if (ui !== body) loadFont(ui, 'ui');

  if (dark_mode === 'on') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function AppearanceProvider({ children }) {
  // nameLoaded: true once the lightweight platform-name call returns
  // fullyLoaded: true once the full appearance call returns
  const [appearance, setAppearance] = useState(DEFAULTS);
  const [nameLoaded, setNameLoaded] = useState(false);

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

  const load = (data, { seq, force = false } = {}) => {
    // A response from a superseded request describes a state we have moved on
    // from. Dropping it is the whole point.
    if (seq !== undefined && seq !== loadSeq.current) return;
    if (brandLocked.current && !force) return;
    const merged = { ...DEFAULTS, ...data };
    setAppearance(merged);
    applyTheme(merged);
    if (merged.app_name) document.title = merged.app_name;
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
      return merged;
    });
    setNameLoaded(true);
  }, []);

  useEffect(() => {
    const seq = (loadSeq.current += 1);

    // 1️⃣ Fast call: just the name + logo — runs immediately, no auth needed
    fetchPlatformName()
      .then(({ name, logo, primary_color }) => {
        if (seq !== loadSeq.current) { setNameLoaded(true); return; }
        if (brandLocked.current) { setNameLoaded(true); return; }
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
      .then((res) => load(res.data?.data || {}, { seq }))
      .catch(() => { if (!brandLocked.current && seq === loadSeq.current) applyTheme(DEFAULTS); });
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
    brandLocked.current = false;
    return client.get('/settings/appearance')
      .then((res) => load(res.data?.data || {}, { seq, force: true }))
      .catch(() => {});
  }, []);

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
    refresh();
  }, [accessToken, companyId, refresh]);

  /**
   * Money display: thousands-separated with the company's currency SIGN
   * (₦25,000,000). narrowSymbol prefers the short sign and falls back to the
   * ISO code for currencies that have none (e.g. KES).
   */
  const formatCurrency = useCallback((amount) => {
    const code = appearance.currency || 'USD';
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
    const code = appearance.currency || 'USD';
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
