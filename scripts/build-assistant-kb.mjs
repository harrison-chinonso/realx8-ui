import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Builds the assistant's map of this application, from the code itself.
 *
 * ── Why generated and not written by hand ───────────────────────────────────
 *
 * A navigation assistant is only useful if it names real screens at real paths.
 * A hand-kept list drifts the first time somebody renames a menu item, and the
 * failure is silent and confident: the assistant sends people to a route that
 * 404s, which is worse than not answering at all.
 *
 * So the routes come from App.jsx and the labels, sections and permissions come
 * from navConfig.js — the same two files the application itself navigates by.
 * If a screen moves, this moves with it, and the integrity test fails if a
 * recipe still points at the old place.
 *
 * Run: node scripts/build-assistant-kb.mjs
 */

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

/**
 * Every `to: '/path'` in the nav, with the label, permission and section that
 * accompany it.
 *
 * Parsed with a regex rather than by importing the module, because navConfig
 * imports icon components from lucide-react and a JSX-free Node process cannot
 * load them. The shape is regular enough that this is reliable, and the
 * integrity test catches it if that ever stops being true.
 */
const parseNav = () => {
  const source = read('src/components/layout/navConfig.js');
  const entries = [];

  let section = null;
  let submenu = null;

  for (const line of source.split('\n')) {
    const sectionMatch = line.match(/section:\s*'([^']+)'/);
    if (sectionMatch) { section = sectionMatch[1]; submenu = null; continue; }

    // A `label:` with no `to:` on the same line opens a sub-menu.
    const labelOnly = line.match(/^\s*label:\s*'([^']+)',\s*icon/);
    if (labelOnly && !line.includes('to:')) { submenu = labelOnly[1]; continue; }

    const to = line.match(/to:\s*'([^']+)'/);
    if (!to) continue;

    const label = line.match(/label:\s*'([^']+)'/)?.[1] || null;
    const permission = line.match(/permission:\s*'([^']+)'/)?.[1] || null;

    entries.push({
      route: to[1],
      label,
      section,
      // "Finance → Invoicing" — the trail a person would read aloud.
      trail: [section, submenu, label].filter(Boolean).join(' → '),
      permissions: permission ? [permission] : [],
      source: 'nav',
    });
  }

  return entries;
};

/**
 * Every routed path, including the ones with no menu entry.
 *
 * Detail and edit screens are not in the nav but are absolutely somewhere a
 * person can be sent — "where do I see one invoice" is a real question. They
 * rank lower because nobody navigates to them by name.
 */
const parseRoutes = () => {
  const source = read('src/App.jsx');
  const found = new Set();
  for (const match of source.matchAll(/path="([^"]+)"/g)) {
    const route = match[1];
    // A parameterised route is a shape, not a destination — nobody can be sent
    // to "/finance/invoices/:id" without an id.
    if (route.includes(':') || route === '*') continue;
    found.add(route.startsWith('/') ? route : `/${route}`);
  }
  return [...found];
};

const nav = parseNav();
const navRoutes = new Set(nav.map((entry) => entry.route.split('?')[0]));

const titleCase = (slug) => slug
  .split('-')
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

/**
 * Routes that exist but are not places to send somebody.
 *
 * An OAuth callback and the sign-in pages are reachable and would otherwise be
 * offered as answers — "where do I log in" is not a question somebody already
 * looking at the application needs answered, and a callback URL is machinery.
 */
const NOT_DESTINATIONS = [
  /^\/auth\//,
  /^\/(login|register|forgot-password|reset-password|verify)/,
];

const unlinked = parseRoutes()
  .filter((route) => !navRoutes.has(route))
  .filter((route) => !NOT_DESTINATIONS.some((pattern) => pattern.test(route)))
  .map((route) => {
    const last = route.split('/').filter(Boolean).pop() || 'home';
    return {
      route,
      label: titleCase(last),
      section: null,
      trail: titleCase(last),
      permissions: [],
      source: 'route',
    };
  });

const map = [...nav, ...unlinked].sort((a, b) => a.route.localeCompare(b.route));

const out = path.join(root, 'src/assistant/kb/app-map.generated.json');
fs.writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`);

console.log(`app map: ${map.length} screens (${nav.length} in the menu, ${unlinked.length} reachable but unlinked)`);
console.log(`written to ${path.relative(root, out)}`);
