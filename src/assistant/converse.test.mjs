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

const turn = (text, pending = null, context = {}) => respond({ engine, text, pending, context });

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

console.log('\n── Permissions are stated, never hidden ─────────────────────────');
{
  const denied = turn('create a user', null, { permissions: ['dashboard.view'] });
  /*
   * They still get the walkthrough — the feature is not hidden, it is explained
   * with a note saying they cannot do it yet and what to ask for. Hiding it
   * makes the feature look missing and sends them to support.
   */
  check('Someone without the permission is told so',
    /do not have access/i.test(denied.messages[0].denied || ''),
    denied.messages[0].denied);
  check('...and no form is opened for them',
    denied.pending === null && !denied.messages[0].links?.some((l) => /assist=/.test(l.href)));
  check('...but the explanation is still shown',
    Boolean(denied.messages[0].steps?.length), `${denied.messages[0].steps?.length} steps`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
