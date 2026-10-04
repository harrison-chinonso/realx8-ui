/**
 * The icon in the browser tab (and on a phone's home screen).
 *
 * The Realx8 mark ships with the app and is what index.html declares, so every
 * page has it from the first paint. A company that has uploaded its own icon
 * (Settings → Appearance → Browser tab icon) replaces it once its appearance
 * loads; anything else — no company, a platform admin, a company that never
 * set one — puts the Realx8 mark back.
 */
const DEFAULT_ICONS = {
  'app-icon': { href: '/favicon.svg', type: 'image/svg+xml' },
  'app-icon-png': { href: '/favicon-32.png', type: 'image/png' },
  'app-touch-icon': { href: '/apple-touch-icon.png', type: null },
};

export function applyTabIcon(url) {
  if (typeof document === 'undefined') return;
  const custom = typeof url === 'string' ? url.trim() : '';
  Object.entries(DEFAULT_ICONS).forEach(([id, fallback]) => {
    const link = document.getElementById(id);
    if (!link) return;
    const href = custom || fallback.href;
    if (link.getAttribute('href') === href) return;
    link.setAttribute('href', href);
    // A company's icon may be PNG, JPEG or WebP; let the browser read the type.
    if (custom || !fallback.type) link.removeAttribute('type');
    else link.setAttribute('type', fallback.type);
  });
}
