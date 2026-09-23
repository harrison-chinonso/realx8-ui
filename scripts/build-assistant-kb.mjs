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

  /*
   * Entries are read as whole OBJECTS, not as lines.
   *
   * This was line-based, and every nav entry written across several lines lost
   * whatever sat on the other lines. `/receipts` is the one that exposed it: it
   * declares `permission: 'finance.commissions.view'` on its own line, the
   * parser never saw it, and the screen went into the app map as needing
   * nothing at all. That map is now what the assistant checks before it will
   * explain anything — so a permission dropped here becomes a screen described
   * to somebody the menu hides it from.
   */
  const block = (at) => {
    let start = source.lastIndexOf('{', at);
    let depth = 0;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
      }
    }
    return source.slice(start);
  };

  /** The section and sub-menu a given offset falls under. */
  const contextAt = (at) => {
    const before = source.slice(0, at);
    const sections = [...before.matchAll(/section:\s*'([^']+)'/g)];
    const section = sections.length ? sections[sections.length - 1][1] : null;
    // A `label:` with an icon and no `to:` opens a sub-menu.
    const submenus = [...before.matchAll(/^\s*label:\s*'([^']+)',\s*icon[^\n]*$/gm)]
      .filter((m) => !m[0].includes('to:'));
    const lastSection = sections.length ? sections[sections.length - 1].index : -1;
    const submenu = submenus.length && submenus[submenus.length - 1].index > lastSection
      ? submenus[submenus.length - 1][1]
      : null;
    return { section, submenu };
  };

  const list = (text, key) => {
    const match = text.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
    return match ? [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  };

  for (const match of source.matchAll(/to:\s*'([^']+)'/g)) {
    const text = block(match.index);
    const { section, submenu } = contextAt(match.index);
    const label = text.match(/label:\s*'([^']+)'/)?.[1] || null;
    const permission = text.match(/permission:\s*'([^']+)'/)?.[1] || null;

    entries.push({
      route: match[1],
      label,
      section,
      // "Finance → Invoicing" — the trail a person would read aloud.
      trail: [section, submenu, label].filter(Boolean).join(' → '),
      permissions: permission ? [permission] : [],
      /*
       * The role dimension, which a permission name does not capture. Payment
       * Approvals is refused to buyers by the API regardless of what they hold,
       * and My Invoices is shown ONLY to them — so both directions are carried.
       */
      showForTypes: list(text, 'showForTypes'),
      hideForTypes: list(text, 'hideForTypes'),
      hideForSuperior: /hideForSuperior:\s*true/.test(text),
      // The platform-owner screens. Gated by BEING a superior admin, which is
      // not a permission and not a user type — navConfig's own third axis.
      superiorAdminOnly: /superiorAdminOnly:\s*true/.test(text),
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

    /*
     * An unlinked screen inherits from the menu entry it sits under.
     *
     * These used to go in with no permissions at all, which — now that the
     * assistant refuses to describe anything it cannot confirm access to —
     * read as "open to everybody". `/properties/create` is the plain example:
     * it has no menu entry of its own, and a buyer would have been walked
     * through creating a property.
     *
     * The parent is the longest menu route the path sits beneath, and its
     * rules apply here too: you cannot reach Create Invoice without reaching
     * Invoicing first.
     */
    const parent = nav
      .filter((entry) => entry.route !== '/' && route.startsWith(`${entry.route}/`))
      .sort((a, b) => b.route.length - a.route.length)[0];

    return {
      route,
      label: titleCase(last),
      section: parent?.section ?? null,
      trail: parent ? `${parent.trail} → ${titleCase(last)}` : titleCase(last),
      permissions: parent?.permissions ?? [],
      showForTypes: parent?.showForTypes ?? [],
      hideForTypes: parent?.hideForTypes ?? [],
      superiorAdminOnly: parent?.superiorAdminOnly ?? false,
      /*
       * With no parent to inherit from there is nothing to check, and an
       * unverifiable screen must not be described. `/settings`, `/users` and
       * `/commissions` are all top-level paths whose real menu entries live one
       * level down, so they land here.
       */
      unverified: !parent,
      source: 'route',
    };
  });

/**
 * One entry per route, even when the menu lists it twice.
 *
 * A screen can legitimately appear in two places for two audiences — the
 * realtor leaderboard is under Realtor Hub for realtors and under User
 * Management → Realtor for the staff who administer them, with `showForTypes`
 * keeping them apart so nobody sees it listed twice.
 *
 * The assistant, though, keys its screen rules BY ROUTE, so a second entry
 * silently overwrote the first: the last one wins, and the last one here says
 * "realtors only" — which would have refused an administrator any guidance
 * about a screen they own. Nothing would have errored.
 *
 * So duplicates are merged, and merged toward what is REACHABLE: a type
 * restriction on one listing is not a restriction on the screen if the other
 * listing carries none.
 */
const mergeEntries = (a, b) => ({
  ...a,
  // Needed only where BOTH listings demand it — satisfying either one gets you in.
  permissions: (a.permissions || []).filter((p) => (b.permissions || []).includes(p)),
  // An unrestricted listing means the screen is not type-restricted at all.
  showForTypes: (a.showForTypes?.length && b.showForTypes?.length)
    ? [...new Set([...a.showForTypes, ...b.showForTypes])]
    : [],
  hideForTypes: (a.hideForTypes || []).filter((t) => (b.hideForTypes || []).includes(t)),
  superiorAdminOnly: Boolean(a.superiorAdminOnly && b.superiorAdminOnly),
});

const byRoute = new Map();
for (const entry of [...nav, ...unlinked]) {
  const existing = byRoute.get(entry.route);
  // The first listing keeps its trail: nav order is the order a person reads.
  byRoute.set(entry.route, existing ? mergeEntries(existing, entry) : entry);
}

const map = [...byRoute.values()].sort((a, b) => a.route.localeCompare(b.route));

/*
 * `--out <path>` so the integrity test can regenerate into a temporary file
 * and compare, rather than either trusting the committed artefact or
 * rewriting it as a side effect of running tests. Default unchanged.
 */
const outFlag = process.argv.indexOf('--out');
const out = outFlag !== -1 && process.argv[outFlag + 1]
  ? path.resolve(process.argv[outFlag + 1])
  : path.join(root, 'src/assistant/kb/app-map.generated.json');
fs.writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`);

console.log(`app map: ${map.length} screens (${nav.length} in the menu, ${unlinked.length} reachable but unlinked)`);
console.log(`written to ${path.relative(root, out)}`);
