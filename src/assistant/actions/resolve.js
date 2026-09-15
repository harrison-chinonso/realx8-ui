import { EXTRACTORS, DIRECT_EXTRACTORS, matchOneOf } from './slots/extract.js';

/**
 * Turning a matched action into either a hand-off or a question.
 *
 * ── Why this is a conversation and not a form ───────────────────────────────
 *
 * People say "create a user" and stop. They also say "register John Adeyemi,
 * john@example.com, 08031112222" in one breath. Both have to work, so values
 * are extracted from whatever was said and the assistant asks only for what is
 * genuinely still missing — one question at a time, in declaration order, so it
 * never feels like an interrogation.
 */

/** Pull every slot this utterance happens to contain. */
export const extractSlots = (action, utterance, existing = {}) => {
  const values = { ...existing };

  for (const slot of action.slots || []) {
    if (values[slot.name] !== undefined && values[slot.name] !== null) continue;
    // A `oneOf` slot carries its own options, so it is matched rather than
    // read — see matchOneOf for why free text is the wrong answer there.
    const found = slot.type === 'oneOf'
      ? matchOneOf(utterance, slot.options)
      : EXTRACTORS[slot.type]?.(utterance);
    if (found !== null && found !== undefined) values[slot.name] = found;
  }

  return values;
};

/** Required slots with nothing in them yet, in the order they were declared. */
export const missingSlots = (action, values) => (action.slots || [])
  .filter((slot) => slot.required)
  .filter((slot) => values[slot.name] === undefined || values[slot.name] === null);

/**
 * Where an action stands.
 *
 * @returns {{ status: 'ready'|'asking', action, values, ask?, href?, outcome? }}
 */
export const resolveAction = (action, utterance, existing = {}) => {
  const values = extractSlots(action, utterance, existing);
  const missing = missingSlots(action, values);

  if (missing.length) {
    return {
      status: 'asking',
      action,
      values,
      ask: missing[0],
      /*
       * How many are left, so somebody can see the end of it. "One more thing"
       * is a very different experience from an unbounded series of questions.
       */
      remaining: missing.length,
    };
  }

  return {
    status: 'ready',
    action,
    values,
    href: action.href(values),
    outcome: action.describe(values),
  };
};

/**
 * Take an answer to the question that was asked.
 *
 * ── Why the answer is tried as the slot's type FIRST ────────────────────────
 *
 * Asked "what is their email?", somebody types "john@example.com" — a bare
 * value with none of the lead-in the extractor looks for in a sentence. Trying
 * the raw answer as the value first, and only then re-running extraction, is
 * what makes a natural reply work.
 *
 * `skip` is honoured for optional slots, because an assistant that cannot be
 * told "no" is one people close.
 */
export const answerSlot = (pending, reply) => {
  const { action, values, ask } = pending;
  const text = String(reply || '').trim();

  if (!ask) return resolveAction(action, text, values);

  if (/^(skip|none|no|nothing|leave it|n\/a)$/i.test(text) && !ask.required) {
    return resolveAction(action, '', { ...values, [ask.name]: null });
  }

  /*
   * The reply is read as a DIRECT answer first — "John Adeyemi" typed in
   * response to "what is their full name?" is the name, with none of the
   * lead-in the sentence extractor looks for.
   */
  const extractor = DIRECT_EXTRACTORS[ask.type] || EXTRACTORS[ask.type];
  const direct = ask.type === 'oneOf'
    ? matchOneOf(text, ask.options)
    : (extractor ? extractor(text) : text);

  if (direct === null || direct === undefined) {
    /*
     * The reply did not contain what was asked for. Re-ask with the slot's own
     * wording rather than repeating the question verbatim — repeating it
     * unchanged reads as though nothing was heard.
     */
    return {
      status: 'asking',
      action,
      values,
      ask,
      invalid: ask.invalid || `I could not read that as ${ask.name}. Could you try again?`,
      remaining: missingSlots(action, values).length,
    };
  }

  return resolveAction(action, text, { ...values, [ask.name]: direct });
};
