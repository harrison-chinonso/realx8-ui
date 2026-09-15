import fs from 'node:fs';
import path from 'node:path';

/**
 * Every recipe must point at a screen that exists.
 *
 * ── Why this is a test and not a comment ────────────────────────────────────
 *
 * A navigation assistant whose links 404 is worse than no assistant: it is
 * confidently wrong, and the person trusts it once. Routes drift — a screen
 * gets renamed, a menu is reorganised — and nothing about a hand-written recipe
 * notices.
 *
 * The app map is generated from navConfig and the router, so this compares the
 * recipes against what the application can actually render. It already caught
 * one route I had guessed at rather than looked up.
 */
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const kb = path.join(root, 'src/assistant/kb');

const map = JSON.parse(fs.readFileSync(path.join(kb, 'app-map.generated.json'), 'utf8'));
const routes = new Set(map.map((entry) => entry.route));

let pass = 0; let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`);
  if (ok) pass += 1; else fail += 1;
};

const files = fs.readdirSync(path.join(kb, 'recipes')).filter((f) => f.endsWith('.js'));
const sources = files.map((f) => ({ file: f, text: fs.readFileSync(path.join(kb, 'recipes', f), 'utf8') }));

const badRoutes = [];
const ids = [];
let recipeCount = 0;

for (const { file, text } of sources) {
  for (const match of text.matchAll(/route: '([^']+)'/g)) {
    recipeCount += 1;
    if (!routes.has(match[1])) badRoutes.push(`${file} → ${match[1]}`);
  }
  for (const match of text.matchAll(/^    id: '([^']+)'/gm)) ids.push(match[1]);
}

check(`Every recipe route is a screen that exists (${recipeCount} checked)`,
  badRoutes.length === 0, badRoutes.join('\n        '));

const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
check('No two recipes share an id', duplicates.length === 0, duplicates.join(', '));

/** A recipe with no keywords is unreachable by anything a person would type. */
const withoutKeywords = sources.filter(({ text }) => {
  const recipes = text.split(/^    id: '/m).slice(1);
  return recipes.some((chunk) => !chunk.includes('keywords:'));
});
check('Every recipe has keywords', withoutKeywords.length === 0,
  withoutKeywords.map((s) => s.file).join(', '));

/** Cross-links must resolve, or "see also" sends somebody nowhere. */
const related = sources.flatMap(({ text }) => [...text.matchAll(/related: \[([^\]]*)\]/g)])
  .flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
const danglingLinks = related.filter((id) => !ids.includes(id));
check('Every "related" link points at a real recipe', danglingLinks.length === 0, danglingLinks.join(', '));

/**
 * Every action must LAND somewhere real, and carry only what the screen reads.
 *
 * The bug this catches shipped once already: find-unpaid-invoices linked to
 * `/finance/invoices?status=unpaid&sort=oldest`, and that page takes its status
 * from the ROUTE, not the query string. The link resolved, the page rendered,
 * and the filter was silently ignored — so the assistant looked like it had
 * done the thing while doing nothing at all. A dead link is obvious; this is
 * not, which is why it is asserted rather than left to be noticed.
 */
const { actions } = await import('../actions/defs/index.js');

const sample = (action) => Object.fromEntries(
  (action.slots || []).map((slot) => [slot.name, slot.type === 'dateRange'
    ? { from: '2026-01-01', to: '2026-01-31', label: 'test' }
    : 'test']),
);

const badActionRoutes = [];
for (const action of actions) {
  const href = action.href(sample(action));
  const path = href.split('?')[0];
  if (!routes.has(path)) badActionRoutes.push(`${action.id} → ${path}`);
  if (!routes.has(action.route)) badActionRoutes.push(`${action.id} route → ${action.route}`);
}
check(`Every action links to a screen that exists (${actions.length} checked)`,
  badActionRoutes.length === 0, badActionRoutes.join('\n        '));

/**
 * A recipe that shares an id with an action must say so.
 *
 * They are the same task described twice, and in the ranking the prose usually
 * wins on keyword overlap alone — leaving the action, which actually fills
 * things in, unreachable. `fulfilledBy` is how the recipe defers to it. This
 * caught `export-report` and `create-property` after `create-user` had already
 * shipped broken, which is three of three: the link is not something to
 * remember, so it is asserted.
 */
const { recipes: allRecipes } = await import('./index.js');
const shadowing = allRecipes
  .filter((r) => actions.some((a) => a.id === r.id))
  .filter((r) => r.fulfilledBy !== r.id);
check('A recipe sharing an action id defers to it', shadowing.length === 0,
  shadowing.map((r) => r.id).join(', '));

/** An action with no keywords can never be reached by asking for it. */
const actionsWithoutKeywords = actions.filter((a) => !a.keywords?.length);
check('Every action has keywords', actionsWithoutKeywords.length === 0,
  actionsWithoutKeywords.map((a) => a.id).join(', '));

/**
 * A write action must declare a permission. One that does not is offered to
 * everybody, and the first time anybody notices is when somebody without the
 * right to create a user is walked through creating one.
 */
const unguarded = actions.filter((a) => a.kind === 'write' && !a.permissions?.length);
check('Every write action names the permission it needs', unguarded.length === 0,
  unguarded.map((a) => a.id).join(', '));

/**
 * The gate is only as good as the map it checks against.
 *
 * Permission now decides whether anything is explained at all, so a screen that
 * reaches the map without its rules is not a cosmetic gap — it is a screen
 * described to somebody the menu hides it from. The line-based nav parser used
 * to drop every entry written across several lines, which is how /receipts
 * arrived declaring no permission despite navConfig giving it one.
 */
const navEntries = map.filter((entry) => entry.source === 'nav');
const guarded = navEntries.filter((entry) => entry.permissions?.length
  || entry.showForTypes?.length || entry.hideForTypes?.length);
check(`Most menu screens carry a rule (${guarded.length}/${navEntries.length})`,
  guarded.length >= navEntries.length * 0.75,
  `${navEntries.length - guarded.length} with no permission and no role limit`);

/** A screen with no rule to check must say so, rather than read as public. */
const unruled = map.filter((entry) => entry.source !== 'nav'
  && !entry.permissions?.length && !entry.showForTypes?.length
  && !entry.hideForTypes?.length && !entry.unverified && !entry.superiorAdminOnly);
check('Every unlinked screen either inherits a rule or is marked unverified',
  unruled.length === 0, unruled.map((e) => e.route).join(', '));

/*
 * The one that would be caught last and hurt most: a route that creates,
 * approves or configures something, reachable without any permission at all.
 */
const dangerous = map.filter((entry) => /\/(create|new|approve|settings|roles)\b/.test(entry.route))
  .filter((entry) => !entry.permissions?.length && !entry.hideForTypes?.length
    && !entry.unverified && !entry.superiorAdminOnly);
check('No create/approve/configure screen is left unguarded',
  dangerous.length === 0, dangerous.map((e) => e.route).join(', '));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
