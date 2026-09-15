import { buildEngine, ask } from './engine.js';
import { recipes } from './kb/index.js';
import { actions } from './actions/defs/index.js';
import { resolveAction, answerSlot } from './actions/resolve.js';
import appMap from './kb/app-map.generated.json' with { type: 'json' };

/**
 * The assistant, against the questions people actually type.
 *
 * Two things are being checked, and the second matters more. It should find the
 * right thing for a plainly-worded question — and it should REFUSE to answer
 * one it does not know, because a retrieval system with no language model that
 * bluffs is worse than one that says so.
 */
let pass = 0; let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${label}${detail ? `\n        ${detail}` : ''}`);
  if (ok) pass += 1; else fail += 1;
};

const engine = buildEngine({ appMap, recipes, actions });

/**
 * A fully-permissioned administrator — every grant the application mentions,
 * and the role that goes with it.
 *
 * Deliberately NOT a wildcard. A wildcard is treated as unrestricted and skips
 * the role checks, which would let the buyer-only walkthroughs compete for
 * staff phrasing: "what needs approving" is the approvals queue when staff ask
 * it and a buyer's own payment when a buyer does, and only the role separates
 * them. Holding every permission does not make somebody a buyer.
 *
 * Built from the app map and the knowledge base, so a new permission cannot
 * quietly leave this fixture behind.
 */
const ADMIN = {
  permissions: [...new Set([
    ...appMap.flatMap((entry) => entry.permissions || []),
    ...recipes.flatMap((recipe) => recipe.permissions || []),
    ...actions.flatMap((action) => action.permissions || []),
  ])],
  role: 'admin',
};
const answer = (q, context = ADMIN) => ask(engine, q, context);
const idOf = (a) => a.action?.id || a.recipe?.id || a.entry?.route || null;

console.log('\n── It finds the right thing for a plain question ────────────────');
{
  const cases = [
    ['how do I approve a payment', 'approve-payment'],
    ['create a user', 'create-user'],
    ['add a new property', 'create-property'],
    ['export transactions to csv', 'export-report'],
    ['set up a commission plan', 'commission-plan'],
    ['run a promotion', ['promotion', 'create-promotion']],
    ['how do I raise an invoice', 'raise-invoice'],
    ['a client overpaid', 'overpayment'],
    ['what needs approving', 'find-payments-to-approve'],
    ['who owes us money', 'find-unpaid-invoices'],
  ];
  for (const [question, expected] of cases) {
    const got = answer(question);
    const wanted = Array.isArray(expected) ? expected : [expected];
    check(`“${question}”`, wanted.includes(idOf(got)), `→ ${idOf(got)} (${got.kind}, ${got.confidence})`);
  }
}

console.log('\n── It understands how people actually type ──────────────────────');
{
  const cases = [
    ['abeg how i wan add a house', ['create-property', 'create-property']],
    ['i need to bill someone', ['raise-invoice']],
    ['where do i see what realtors earned', ['commission-plan', 'commission-payout', 'realtor-commission-request', '/finance/commission-analytics', '/finance/my-commission']],
    ['stop chasing my clients', ['payment-reminders']],
    ['someone cannot see the finance menu', ['permissions']],
  ];
  for (const [question, expected] of cases) {
    const got = answer(question);
    check(`“${question}”`, expected.includes(idOf(got)), `→ ${idOf(got)} (${got.kind})`);
  }
}

console.log('\n── It says when it does not know ────────────────────────────────');
{
  /*
   * The important half. The matcher this replaces scored a hit on any single
   * keyword, so anything containing "payment" got a confident wrong answer.
   */
  for (const question of ['what is the weather', 'asdkjhasd', 'tell me a joke']) {
    const got = answer(question);
    check(`“${question}” is not answered`, got.kind === 'unknown', `→ ${got.kind}/${idOf(got)}`);
  }
}

console.log('\n── It offers choices when two things are close ──────────────────');
{
  const got = answer('commission');
  check('A one-word question gives alternatives rather than a confident guess',
    got.confidence !== 'high' || got.alternatives.length === 0,
    `${got.confidence}, ${got.alternatives.length} alternative(s)`);
}

console.log('\n── Permissions are honoured ─────────────────────────────────────');
{
  const withoutFinance = answer('approve a payment', { permissions: ['properties.view'] });
  check('Something the person cannot do is flagged, not hidden',
    withoutFinance.accessible === false,
    'they still see it exists — hiding it looks like the feature is missing');

  const withIt = answer('approve a payment', { permissions: ['finance.commissions.view'] });
  check('...and allowed when they hold the permission', withIt.accessible === true, '');
}

console.log('\n── Actions collect what they need ───────────────────────────────');
{
  const createUser = actions.find((a) => a.id === 'create-user');

  const bare = resolveAction(createUser, 'create a user');
  check('“create a user” asks for the name first',
    bare.status === 'asking' && bare.ask.name === 'name', bare.ask?.prompt);

  const named = answerSlot(bare, 'John Adeyemi');
  check('...then for the email', named.status === 'asking' && named.ask.name === 'email', named.ask?.prompt);

  const bad = answerSlot(named, 'not an email');
  check('...and re-asks when the answer is not one',
    bad.status === 'asking' && bad.ask.name === 'email' && Boolean(bad.invalid), bad.invalid);

  const done = answerSlot(named, 'john@example.com');
  check('...then it is ready', done.status === 'ready', done.href);
  check('...with the values in the link',
    done.href.includes('name=John+Adeyemi') && done.href.includes('john%40example.com'), done.href);

  /*
   * Said all at once, it should ask nothing. This is the difference between an
   * assistant and a form with extra steps.
   */
  const oneBreath = resolveAction(createUser, 'register a new user called John Adeyemi, john@example.com, 08031112222');
  check('Everything in one sentence needs no questions at all',
    oneBreath.status === 'ready', JSON.stringify(oneBreath.values));
  check('...and picks up the phone too', oneBreath.values.phone === '08031112222', oneBreath.values.phone);
}

console.log('\n── A write action stops at the form ─────────────────────────────');
{
  const createUser = actions.find((a) => a.id === 'create-user');
  const ready = resolveAction(createUser, 'add John Adeyemi, john@example.com');
  check('It says what is left for the human',
    ready.outcome.remaining.some((r) => /role/i.test(r)),
    ready.outcome.remaining.join(' · '));
  /*
   * Role, and anything like it, is a permission grant. Inferring one from "make
   * him an admin" is the wrong place for a chat bot to be clever.
   */
  check('...and never fills in the role itself',
    !ready.href.includes('role='), ready.href);
}

console.log('\n── A read action just goes ──────────────────────────────────────');
{
  const exportReport = actions.find((a) => a.id === 'export-report');
  const ready = resolveAction(exportReport, 'export the report for last month');
  check('A date range is understood without asking', ready.status === 'ready', ready.href);
  check('...and named back, so a wrong reading is obvious',
    /last month/.test(ready.outcome.summary), ready.outcome.summary);

  /*
   * The tab is one of three real ones or it is nothing. It used to be free
   * text, which put the whole sentence in the URL — a tab that does not exist,
   * presented as though it had been understood.
   */
  const invoices = resolveAction(exportReport, 'download invoices for last month');
  check('A named tab is picked out', invoices.values.tab === 'invoices', invoices.href);
  check('...and a sentence that names no tab leaves it alone',
    ready.values.tab === undefined && !ready.href.includes('tab='), ready.href);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
