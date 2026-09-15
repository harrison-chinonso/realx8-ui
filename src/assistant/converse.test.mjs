import { buildEngine } from './engine.js';
import { recipes } from './kb/index.js';
import { actions } from './actions/defs/index.js';
import { respond } from './converse.js';
import appMap from './kb/app-map.generated.json' with { type: 'json' };

/**
 * One turn at a time, through the real engine and the real knowledge base.
 *
 * These are the paths a person walks into and nobody tests by hand: answering a
 * question with something that is not an answer, changing their mind halfway,
 * asking something the assistant cannot know.
 */

const engine = buildEngine({ appMap, recipes, actions });
let pass = 0; let fail = 0;

const check = (label, condition, detail = '') => {
  if (condition) { pass += 1; console.log(`  \x1b[32mPASS\x1b[0m  ${label}`); }
  else { fail += 1; console.log(`  \x1b[31mFAIL\x1b[0m  ${label}`); }
  if (detail) console.log(`        ${detail}`);
};

/**
 * The default context is an administrator who may do everything.
 *
 * It has to be stated rather than left empty: an empty context now means "no
 * permission could be confirmed", which is a refusal. That is the correct
 * default for the real widget — it always passes the signed-in person's
 * grants — and the tests below that care about permissions pass their own.
 */
const ADMIN = { permissions: ['*'], role: 'admin' };
const turn = (text, pending = null, context = ADMIN) => respond({ engine, text, pending, context });

console.log('\n── It answers what it knows, locally ────────────────────────────');
{
  const howTo = turn('how do I approve a payment');
  check('A how-to comes back with steps, not a link to go and find out',
    !howTo.defer && howTo.messages[0].steps?.length > 0,
    `${howTo.messages[0].steps?.length} steps`);
  check('...and never asks the server for something it already knows',
    howTo.defer === false);

  const nav = turn('where is the promotions page');
  check('A screen question gives the trail and a link',
    !nav.defer && nav.messages[0].links?.length === 1,
    nav.messages[0].content);

  /*
   * And where two screens really are both plausible answers, both are offered
   * rather than one of them picked.
   */
  const ambiguous = turn('take me to invoices');
  check('...but a genuinely ambiguous one offers the choice',
    ambiguous.messages[0].options?.length >= 2,
    ambiguous.messages[0].options?.map((o) => o.label).join(' · '));
}

console.log('\n── It hands data questions to the server ────────────────────────');
{
  const data = turn('how much has Chidi Okonkwo paid me in total this year');
  check('Something only the database can answer is deferred',
    data.defer === true, `defer=${data.defer}`);
}

console.log('\n── An action collects what it needs, and can be escaped ─────────');
{
  const start = turn('create a user');
  check('It asks the first question', Boolean(start.pending), start.messages[0].content);

  /*
   * A reply with no name in it is re-asked. Note what is NOT tested here: that
   * an odd-looking name is rejected. Names in this market are various, and a
   * bot that refuses one it does not recognise is worse than one that accepts
   * it — the form is reviewed by a person before anything is created.
   */
  const junk = turn('yes please go ahead and do that', start.pending);
  check('A reply that contains no name is re-asked, not accepted',
    Boolean(junk.pending) && junk.pending.ask.name === 'name',
    junk.messages[0].content);

  const named = turn('John Adeyemi', junk.pending);
  check('...and a real answer moves it on', named.pending?.ask.name === 'email',
    named.messages[0].content);

  /*
   * The trap this avoids: being stuck in a form. Somebody who changes their
   * mind mid-action has to be able to leave, and typing a new question is how
   * people actually do it.
   */
  const escaped = turn('actually how do I approve a payment', named.pending);
  check('A new question mid-action escapes it', escaped.pending === null,
    escaped.messages[0].content?.slice(0, 60));
  check('...and is answered rather than swallowed',
    escaped.messages[0].steps?.length > 0);

  const cancelled = turn('cancel', named.pending);
  check('"cancel" drops it', cancelled.pending === null, cancelled.messages[0].content);

  /*
   * And the case that must NOT escape: an answer that happens to read like a
   * sentence opener is still an answer.
   */
  const stillAnswering = turn('Grace Nwosu', named.pending);
  check('...but an ordinary answer is not mistaken for an escape',
    stillAnswering.pending === null || stillAnswering.pending.ask.name !== 'name',
    JSON.stringify(stillAnswering.pending?.values ?? stillAnswering.messages[0].filled));
}

console.log('\n── A finished action stops at the form ──────────────────────────');
{
  const ready = turn('add a user John Adeyemi, john@example.com');
  check('It offers the link rather than doing it',
    ready.pending === null && ready.messages[0].links?.[0].href.includes('assist=create-user'),
    ready.messages[0].links?.[0].href);
  check('...and says what the human still has to do',
    ready.messages[0].remaining?.length > 0,
    ready.messages[0].remaining?.join(' · '));
}

console.log('\n── A name is extracted, not assumed ─────────────────────────────');
{
  /*
   * This shipped wrong once: the name slot took free text, so "create a
   * property called Lekki Gardens" opened the form with the property named
   * "create a property called Lekki Gardens".
   */
  const named = turn('create a property called Lekki Gardens Phase 3');
  check('The name after "called" is the name',
    named.messages[0].links?.[0].href.includes('name=Lekki+Gardens+Phase+3'),
    named.messages[0].links?.[0].href);

  const quoted = turn('create a promotion called "Easter Offer"');
  check('...and a quoted one works too',
    quoted.messages[0].links?.[0].href.includes('name=Easter+Offer'),
    quoted.messages[0].links?.[0].href);

  const unnamed = turn('create a property');
  check('...and a sentence naming nothing carries no name at all',
    !unnamed.messages[0].links?.[0].href.includes('name='),
    unnamed.messages[0].links?.[0].href);
}

console.log('\n── Asking to DO something reaches the thing that does it ────────');
{
  /*
   * The walkthrough and the action describe the same task in nearly the same
   * words. "Create a promotion" used to produce "did you mean: Create a
   * promotion / Run a promotion" — a choice with no difference in it.
   */
  const doIt = turn('create a promotion');
  check('An imperative opens the wizard rather than offering a choice',
    doIt.messages[0].links?.[0].href.includes('assist=create-promotion'),
    doIt.messages[0].content);

  const explain = turn('how do I run a promotion');
  check('...while "how do I" still gets the walkthrough',
    doIt.messages[0].links?.[0].href !== explain.messages[0].links?.[0].href
      && explain.messages[0].steps?.length > 0,
    `${explain.messages[0].steps?.length} steps`);
}

console.log('\n── Permission is confirmed BEFORE anything is explained ─────────');
{
  /*
   * The rule: no guidance and no redirection for a task this account cannot
   * perform. Not the steps, not the screen name, not the trail, not a link —
   * all four are directions to a door that will be shut.
   */
  const CLIENT = { permissions: ['dashboard.view', 'properties.view', 'support.view'], role: 'client' };

  const denied = turn('create a user', null, CLIENT);
  const m = denied.messages[0];
  check('An action they cannot perform is refused', /cannot walk you through it/i.test(m.content), m.content);
  check('...with no steps', !m.steps?.length);
  check('...no screen name or trail', !m.trail);
  check('...no link to it', !m.links?.length);
  check('...and no form started', denied.pending === null);

  const walkthrough = turn('how do I approve a payment', null, CLIENT);
  check('A walkthrough they cannot follow is refused too',
    !walkthrough.messages[0].steps?.length, walkthrough.messages[0].content);

  /*
   * Approving a payment is gated by ROLE on the server, not by a permission
   * name — so holding every finance permission is not the test.
   */
  const staff = turn('how do I approve a payment', null,
    { permissions: ['finance.invoices.view', 'finance.commissions.view'], role: 'employee' });
  check('...and allowed for staff, who are gated by role not permission',
    staff.messages[0].steps?.length > 0, `${staff.messages[0].steps?.length} steps`);

  const nav = turn('where is payment approvals', null, CLIENT);
  check('A screen they cannot open is not located for them',
    !nav.messages[0].links?.length && !nav.messages[0].trail, nav.messages[0].content);

  /*
   * And the quieter leak: a "did you mean" list is guidance as much as an
   * answer is.
   */
  const ambiguous = turn('payments', null, CLIENT);
  const offered = ambiguous.messages[0]?.options || [];
  check('Nothing forbidden is offered as an alternative either',
    offered.every((o) => !/approval|commission|payout/i.test(o.label)),
    offered.map((o) => o.label).join(' · ') || '(none offered)');
}

console.log('\n── An unconfirmed permission is a refusal ───────────────────────');
{
  /*
   * Nothing supplied means nothing could be checked, and the rule is that
   * permission is confirmed BEFORE guidance. This previously returned "do not
   * pretend to know" and allowed everything through, which meant any caller
   * that forgot to pass permissions got the full run of the application.
   */
  const unknown = respond({ engine, text: 'create a user', pending: null, context: {} });
  check('A caller that supplies no permissions is refused, not trusted',
    /cannot walk you through it/i.test(unknown.messages[0].content),
    unknown.messages[0].content.slice(0, 60));
}

console.log('\n── ...without locking out the people who do have access ─────────');
{
  /*
   * A superior admin carries an empty permission list — they need no entries.
   * Gating on the list alone would refuse them the entire application, which is
   * the failure mode that makes strict permission checks dangerous.
   */
  const superior = turn('create a user', null, { permissions: [], unrestricted: true, role: 'super_admin' });
  check('A superior admin is not refused by an empty permission list',
    Boolean(superior.pending) || superior.messages[0].links?.length > 0,
    superior.messages[0].content);

  const wildcard = turn('create a user', null, { permissions: ['*'], role: 'admin' });
  check('...nor is a wildcard grant', Boolean(wildcard.pending), wildcard.messages[0].content);

  const held = turn('create a user', null, { permissions: ['users.manage', 'users.view'], role: 'admin' });
  check('...and the permission itself still works', Boolean(held.pending), held.messages[0].content);

  /*
   * Buyers must keep their own help. Their screens carry no permissions, so
   * tightening the gate must not have swept them up.
   */
  const buyer = turn('how do I pay my invoice', null,
    { permissions: ['dashboard.view', 'properties.view', 'support.view'], role: 'client' });
  check('A buyer still gets buyer help',
    buyer.defer || buyer.messages[0].steps?.length > 0 || buyer.messages[0].links?.length > 0,
    buyer.messages[0]?.content || '(deferred to the server)');
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
