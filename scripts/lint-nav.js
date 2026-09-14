/**
 * Finds menu items that are reachable on some layout templates and not others.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 *
 * ModernLayout decided which sections sat in its top bar from a list of names:
 *
 *     const PRIMARY_SECTION_NAMES = ['Property', 'CRM', 'Finance', 'Media', 'Users'];
 *
 * Two of those had been renamed in navConfig — 'CRM' became 'Leads & Deals',
 * 'Users' became 'User Management'. Nothing errored. The names simply stopped
 * matching, and those two sections quietly dropped out of the top bar on that
 * one template while every other template still showed them. A menu that is
 * different depending on which theme you picked, with no failure anywhere.
 *
 * The class is "a layout refers to navConfig by a string". This checks every
 * such string still names something, so the next rename is caught by a command
 * rather than by a user saying a menu item is missing.
 *
 * Run: npm run lint:nav
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAYOUT_DIR = path.join(ROOT, 'src', 'components', 'layout');
const NAV_CONFIG = path.join(LAYOUT_DIR, 'navConfig.js');

const RED = '\x1b[31m'; const YELLOW = '\x1b[33m'; const GREEN = '\x1b[32m';
const DIM = '\x1b[2m'; const RESET = '\x1b[0m';

const source = fs.readFileSync(NAV_CONFIG, 'utf8');

/** Strip comments, so prose about a section is not mistaken for a section. */
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ');

const nav = stripComments(source);

const sectionNames = new Set(
  [...nav.matchAll(/section:\s*'([^']+)'/g)].map((match) => match[1]),
);
const routes = new Set(
  [...nav.matchAll(/to:\s*'([^']+)'/g)].map((match) => match[1]),
);

const layouts = fs.readdirSync(LAYOUT_DIR)
  .filter((file) => file.endsWith('.jsx'))
  .map((file) => ({ file, text: stripComments(fs.readFileSync(path.join(LAYOUT_DIR, file), 'utf8')) }));

const problems = [];

layouts.forEach(({ file, text }) => {
  /**
   * Comparisons against a section name: `s.section === 'X'`,
   * `NAMES.includes(s.section)`, or a literal array of names used to partition.
   */
  const compared = new Set();

  [...text.matchAll(/\.section\s*(?:===|!==)\s*'([^']+)'/g)].forEach((m) => compared.add(m[1]));
  [...text.matchAll(/'([^']+)'\s*(?:===|!==)\s*\w+\.section/g)].forEach((m) => compared.add(m[1]));
  [...text.matchAll(/SECTION[_A-Z]*\s*=\s*\[([^\]]+)\]/g)].forEach((m) => {
    [...m[1].matchAll(/'([^']+)'/g)].forEach((n) => compared.add(n[1]));
  });

  compared.forEach((name) => {
    // 'Account' is a deliberate sentinel: ModernLayout looks for a section that
    // navConfig does not define and falls back. Reported as a warning, because
    // it is dead weight rather than a break.
    if (sectionNames.has(name)) return;
    problems.push({
      file,
      name,
      kind: name === 'Account' ? 'warn' : 'error',
      why: name === 'Account'
        ? 'matches no section — the fallback beside it is doing all the work'
        : 'matches no section in navConfig, so whatever it was meant to select is silently excluded',
    });
  });

  /** Routes named in a layout that navConfig does not define. */
  [...text.matchAll(/to="(\/[^"]*)"/g)].forEach((m) => {
    const route = m[1];
    if (routes.has(route) || route === '/') return;
    problems.push({
      file, name: route, kind: 'warn',
      why: 'hardcoded link that navConfig does not declare — it cannot be permission-gated with the rest',
    });
  });
});

console.log(`\nChecked ${layouts.length} layout files against ${sectionNames.size} sections `
  + `and ${routes.size} routes in navConfig.\n`);

const errors = problems.filter((p) => p.kind === 'error');
const warnings = problems.filter((p) => p.kind === 'warn');

const report = (label, colour, list) => {
  if (!list.length) return;
  console.log(`${colour}${label} (${list.length})${RESET}`);
  list.forEach((problem) => {
    console.log(`  ${colour}${problem.file}${RESET} → "${problem.name}"`);
    console.log(`    ${DIM}${problem.why}${RESET}`);
  });
  console.log('');
};

report('MUST FIX — a name that selects nothing', RED, errors);
report('REVIEW', YELLOW, warnings);

if (errors.length) {
  console.log(`${RED}${errors.length} layout reference(s) name something that does not exist.${RESET}\n`);
  process.exit(1);
}
console.log(`${GREEN}Every section a layout names exists.${RESET}`
  + (warnings.length ? ` ${YELLOW}${warnings.length} to review.${RESET}` : '') + '\n');
