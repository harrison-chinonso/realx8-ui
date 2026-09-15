import { ask } from './engine.js';
import { resolveAction, answerSlot } from './actions/resolve.js';

/**
 * One turn of conversation.
 *
 * ── Why this is not inside the React component ──────────────────────────────
 *
 * Everything interesting about the assistant is here: whether a question is
 * answered locally or handed to the server, how an action collects what it
 * needs, when it gives up. Putting that in a component would make it reachable
 * only by rendering one, and the branches that matter — a half-finished action
 * interrupted by an unrelated question, a cancel, a re-ask — are precisely the
 * ones nobody exercises by hand. `converse.test.mjs` drives them directly.
 *
 * ── The local-first arrangement ─────────────────────────────────────────────
 *
 * The local engine answers navigation, how-to and actions: it is instant, free,
 * needs no API key, and knows this application's own screens by name because
 * the map is generated from the router. The server assistant answers questions
 * about the tenant's DATA — "how much has Chidi paid" — which the local engine
 * cannot see and should not guess at.
 *
 * So local runs first, and only a question it does not recognise is deferred.
 * A tenant with no API key still gets everything except the data questions,
 * rather than a widget that does not appear at all.
 */

/** A reply the widget can render: prose, plus any of links / steps / options. */
const say = (content, extra = {}) => ({ role: 'assistant', content, ...extra });

const CANCEL = /^(cancel|stop|never ?mind|forget it|quit|exit)$/i;

/**
 * Questions about the tenant's own figures, which belong to the server.
 *
 * ── Why this is checked BEFORE the local engine, not after ──────────────────
 *
 * "How much has Chidi Okonkwo paid me this year" scored 26 against a
 * commission walkthrough and came back CONFIDENT — a wrong answer delivered
 * without hesitation, which is worse than no answer, because the person acts on
 * it. The local corpus is screens and procedures; it contains no invoices, no
 * payments and no people, so a question whose answer is a NUMBER FROM THE
 * DATABASE can never be answered well here however high it scores.
 *
 * So the phrasing decides, not the score. "How much", "how many", "who owes" —
 * these want data. "How do I" wants a procedure, and is deliberately excluded.
 */
const DATA_QUESTION = new RegExp([
  '\\bhow (much|many)\\b',
  '\\bwho (owes|has paid|hasn.t paid|is owing)\\b',
  '\\b(what|which) .*\\b(owes?|owing|outstanding|overdue|unpaid|balance)\\b',
  '\\b(total|balance|outstanding|owed|owing|overdue) .*\\b(is|are|so far|to date|this (month|week|year)|last (month|week|year))\\b',
  '\\blist (all|my|the) \\w+ (that|who|which|with)\\b',
].join('|'), 'i');

/**
 * Whether an interruption is really an interruption.
 *
 * Mid-action, most replies are the answer to the question just asked. But
 * somebody who types "actually how do I approve a payment" wants that, not to
 * have it read as a person's name — and being trapped in a half-finished form
 * is the single most irritating thing a chat assistant does.
 *
 * The test is deliberately conservative: a question mark, or an opening that
 * only ever starts a new request. Anything else is treated as the answer.
 */
const looksLikeNewRequest = (text) => /\?$/.test(text.trim())
  || /^(actually|wait|no,|instead|how do i|where (is|do|can)|what (is|are)|show me|take me|open|go to)\b/i.test(text.trim());

/** The runners-up, as things a person can click instead of retyping. */
const nearest = (result) => [
  // The front-runner belongs in the list. When the assistant is unsure it must
  // not quietly drop its own best guess and offer only the ones behind it.
  ...(result.kind === 'unknown' ? [] : [result]),
  ...(result.alternatives || []),
]
  /*
   * ...but only the ones this person may actually use. A "did you mean" list is
   * guidance like any other, and offering Payment Approvals to a buyer tells
   * them it exists and invites a click that ends in a refusal.
   */
  .filter((alt) => alt.accessible)
  .map((alt) => {
    if (alt.kind === 'action') return { label: alt.action.title, query: alt.action.title };
    if (alt.kind === 'recipe') return { label: alt.recipe.title, query: alt.recipe.title };
    return { label: alt.entry.label, query: alt.entry.label };
  })
  .slice(0, 4);

/** Turn a resolved action into what the person sees. */
const fromResolution = (resolution) => {
  if (resolution.status === 'asking') {
    const { ask: slot, invalid, remaining } = resolution;
    return {
      messages: [say(invalid || slot.prompt, {
        /*
         * How many are left. "One more thing" and an unbounded series of
         * questions feel completely different, and only one of them gets
         * finished.
         */
        note: remaining > 1 ? `${remaining} things needed` : null,
        hint: slot.required ? null : 'or say skip',
      })],
      pending: resolution,
    };
  }

  const { outcome, href, action } = resolution;
  return {
    messages: [say(outcome.summary, {
      filled: outcome.filled,
      /*
       * A write action stops AT the form, never past it. The assistant fills in
       * what it was told and a person presses save — so nothing is created by a
       * sentence that was misread, and the last look at it belongs to somebody
       * who can be held to it.
       */
      remaining: outcome.remaining,
      links: [{ label: action.kind === 'write' ? 'Open the form' : 'Take me there', href }],
    })],
    pending: null,
  };
};

const fromRecipe = (recipe) => ({
  messages: [say(recipe.summary, {
    steps: recipe.steps,
    trail: recipe.trail,
    links: recipe.route ? [{ label: `Go to ${recipe.title}`, href: recipe.route }] : [],
  })],
  pending: null,
});

/** The one reply anybody without the permission gets, whatever they asked. */
const refuse = () => ({ messages: [say(notAllowed())], pending: null, defer: false });

/**
 * Refused, and refused without a lesson attached.
 *
 * ── Why no steps, no screen name, and no link ───────────────────────────────
 *
 * An earlier version explained the task anyway and appended a note saying the
 * person could not perform it. Two things were wrong with that. It walked
 * somebody all the way through a process that would refuse them at the end,
 * which wastes their time and reads as a fault in the software. And it
 * disclosed the shape of the application — which screens exist, where they sit,
 * what the procedure is — to people the menu deliberately hides it from.
 *
 * So the reply names no screen, no route and no steps. It says the account
 * cannot do this and points at the person who can change that, which is the
 * only part that is actually useful to someone without access.
 */
const notAllowed = () => 'That is not something your account can do, so I cannot walk you '
  + 'through it. If you think you should have access, your administrator can arrange it.';

/**
 * Answer one message.
 *
 * @param {object}   engine   from getEngine()
 * @param {string}   text     what was typed
 * @param {object?}  pending  an action part-way through collecting values
 * @param {object}   context  { route, permissions }
 * @returns {{ messages, pending, defer }}  `defer` asks the caller to try the
 *   server assistant instead — the local engine did not recognise this.
 */
export const respond = ({ engine, text, pending = null, context = {} }) => {
  const message = String(text || '').trim();
  if (!message) return { messages: [], pending, defer: false };

  if (pending && CANCEL.test(message)) {
    return { messages: [say('No problem — I have dropped that.')], pending: null, defer: false };
  }

  if (pending && !looksLikeNewRequest(message)) {
    return { ...fromResolution(answerSlot(pending, message)), defer: false };
  }

  const result = ask(engine, message, context);
  const options = nearest(result);

  /*
   * A data question goes to the server even when something local scored well,
   * for the reason set out at DATA_QUESTION. The local runners-up ride along so
   * that a tenant with no API key still gets a useful reply rather than
   * silence.
   */
  if (DATA_QUESTION.test(message)) {
    return { messages: [], pending: null, defer: true, options };
  }

  /*
   * A walkthrough and the action it names are ONE task described twice, so
   * this runs before any confidence test — the two sitting neck and neck is
   * exactly what the link exists to resolve, and asking "did you mean Create a
   * user, or Create a user?" is the failure it was written to prevent.
   *
   * Which of the pair answers depends on what the person may do: the action if
   * they can perform it, the prose (carrying the note about the permission) if
   * they cannot.
   */
  if (result.kind === 'recipe' && result.recipe.fulfilledBy) {
    const twin = engine.actions.find((a) => a.id === result.recipe.fulfilledBy);
    if (twin) {
      if (!result.accessible) return refuse();
      return { ...fromResolution(resolveAction(twin, message)), defer: false };
    }
  }

  if (result.kind === 'action' && result.confidence === 'high') {
    if (!result.accessible) return refuse();
    return { ...fromResolution(resolveAction(result.action, message)), defer: false };
  }

  if (result.kind === 'recipe' && result.confidence === 'high') {
    if (!result.accessible) return refuse();
    return { ...fromRecipe(result.recipe), defer: false };
  }

  if (result.kind === 'navigation' && result.confidence === 'high') {
    // Not even the trail. Naming where a screen sits is itself a direction to
    // it, and the menu already withholds that from this person.
    if (!result.accessible) return refuse();
    const { entry } = result;
    return {
      messages: [say(`${entry.label} is under ${entry.trail}.`, {
        links: [{ label: `Open ${entry.label}`, href: entry.route }],
      })],
      pending: null,
      defer: false,
    };
  }

  /*
   * Not confident. The runners-up are offered rather than guessed between —
   * one click is cheaper for everybody than a confident wrong answer followed
   * by a correction.
   */
  /*
   * Recognised, but not for this person. Refuse rather than fall through to the
   * server: the local engine knows exactly what was being asked for and knows
   * the answer is no, and handing the question on would let it be explained
   * after all.
   */
  if (result.kind !== 'unknown' && !result.accessible) return refuse();

  if (options.length && result.kind !== 'unknown') {
    return {
      messages: [say('I am not certain which you mean — is it one of these?', { options })],
      pending: null,
      defer: false,
    };
  }

  /*
   * Nothing local fits. This is where "how much did Chidi pay in August" ends
   * up, and it is the server assistant's question, not ours — it can see the
   * data. The options go along with the deferral so that if the server is not
   * configured the widget still has something useful to show.
   */
  return { messages: [], pending: null, defer: true, options };
};
