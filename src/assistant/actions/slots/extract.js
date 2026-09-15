/**
 * Pulling values out of what somebody typed.
 *
 * ── Why each extractor refuses more than it accepts ─────────────────────────
 *
 * A slot that guesses is worse than one that asks. "Create a user called John"
 * with a greedy name extractor becomes a user named "called John"; with a
 * cautious one the assistant asks "what is their full name?" and gets it right.
 * The cost is one extra exchange; the cost of the alternative is a real record
 * somebody has to go and delete.
 */

const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();

/** A plausible email, and only that. */
export const extractEmail = (text) => {
  const match = clean(text).match(/\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/);
  return match ? match[0].toLowerCase() : null;
};

/**
 * A Nigerian phone number in any of the forms people type it.
 *
 * Normalised to local 0-leading form, because that is what the forms here
 * expect — handing back +234… would fail their validation and look like the
 * assistant had mangled it.
 */
export const extractPhone = (text) => {
  const digits = clean(text).replace(/[()\s-]/g, '');
  const match = digits.match(/(?:\+?234|0)(\d{10})\b/);
  return match ? `0${match[1]}` : null;
};

/**
 * A person's name.
 *
 * Only taken from an explicit lead-in — "called", "named", "for", "whose name
 * is" — or from a run of capitalised words. Anything looser turns the verb into
 * part of the name.
 */
export const extractName = (text) => {
  const source = clean(text);

  const lead = source.match(
    /\b(?:called|named|name is|by the name of|for)\s+((?:[A-Z][\w'’-]+|mr|mrs|ms|dr)(?:\s+[A-Z][\w'’-]+){0,3})/i,
  );
  if (lead) {
    const name = clean(lead[1]);
    // "for the report" is a lead-in that caught a noun, not a name.
    if (!/^(the|a|an|this|that|my|our)\b/i.test(name)) return name;
  }

  /*
   * Two or more capitalised words in a row, with the first one skipped — a
   * sentence starts with a capital, so "Create John Smith" would otherwise
   * yield "Create John".
   */
  /*
   * Trailing punctuation is stripped before the test. People write
   * "add John Adeyemi, john@example.com" — with the comma attached, "Adeyemi,"
   * fails the capitalised-word test, the run resets, and a name that is plainly
   * there is missed.
   */
  const words = source.split(' ').map((word) => word.replace(/[,.;:!?]+$/, ''));
  const run = [];
  for (let i = 1; i < words.length; i += 1) {
    if (/^[A-Z][\w'’-]+$/.test(words[i])) run.push(words[i]);
    else if (run.length >= 2) break;
    else run.length = 0;
  }
  return run.length >= 2 ? run.join(' ') : null;
};

/**
 * Money, written the way people actually type it: 8m, ₦8 million, 8,000,000.
 * Returns minor units, because everything downstream is in kobo.
 */
export const extractMoney = (text) => {
  const source = clean(text).toLowerCase().replace(/[₦,]/g, '');

  const scaled = source.match(/\b(\d+(?:\.\d+)?)\s*(m|million|k|thousand|bn|b|billion)\b/);
  if (scaled) {
    const factor = /^(m|million)$/.test(scaled[2]) ? 1e6
      : /^(k|thousand)$/.test(scaled[2]) ? 1e3
        : 1e9;
    return Math.round(Number(scaled[1]) * factor * 100);
  }

  /*
   * A bare number is only money when something says so. "create 3 users" must
   * not become three naira, and "unit 2" is not two naira either.
   */
  const bare = source.match(/(?:₦|ngn|naira|amount(?: of)?|price(?: of)?|worth|for)\s*(\d{3,}(?:\.\d+)?)/);
  return bare ? Math.round(Number(bare[1]) * 100) : null;
};

/** A whole number of things: "4 flats", "buy 2", "three units". */
const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

export const extractQuantity = (text) => {
  const source = clean(text).toLowerCase();
  const word = source.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (word) return WORD_NUMBERS[word[1]];
  const digits = source.match(/\b(\d{1,3})\s*(?:units?|flats?|plots?|properties|houses?|of them)\b/);
  if (digits) return Number(digits[1]);
  return null;
};

/**
 * A date range, in the phrasings people use.
 *
 * Returns ISO dates, and the LABEL that was matched, so the assistant can say
 * "last week (6–12 October)" rather than leaving somebody to check whether it
 * understood "last week" the way they meant it.
 */
export const extractDateRange = (text, now = new Date()) => {
  const source = clean(text).toLowerCase();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

  if (/\btoday\b/.test(source)) return { from: iso(today), to: iso(today), label: 'today' };
  if (/\byesterday\b/.test(source)) return { from: iso(daysAgo(1)), to: iso(daysAgo(1)), label: 'yesterday' };

  if (/\bthis week\b/.test(source)) {
    return { from: iso(startOfWeek(today)), to: iso(today), label: 'this week' };
  }
  if (/\blast week\b/.test(source)) {
    const start = startOfWeek(today); start.setDate(start.getDate() - 7);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { from: iso(start), to: iso(end), label: 'last week' };
  }
  if (/\bthis month\b/.test(source)) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(start), to: iso(today), label: 'this month' };
  }
  if (/\blast month\b/.test(source)) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: iso(start), to: iso(end), label: 'last month' };
  }
  if (/\bthis year\b/.test(source)) {
    return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today), label: 'this year' };
  }

  const lastN = source.match(/\b(?:last|past|previous)\s+(\d{1,3})\s*(day|week|month)s?\b/);
  if (lastN) {
    const count = Number(lastN[1]);
    const multiplier = lastN[2] === 'week' ? 7 : lastN[2] === 'month' ? 30 : 1;
    return {
      from: iso(daysAgo(count * multiplier)),
      to: iso(today),
      label: `the last ${count} ${lastN[2]}${count === 1 ? '' : 's'}`,
    };
  }

  // An explicit range somebody typed: 2026-01-01 to 2026-03-31.
  const explicit = source.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-|until|through)\s*(\d{4}-\d{2}-\d{2})/);
  if (explicit) return { from: explicit[1], to: explicit[2], label: `${explicit[1]} to ${explicit[2]}` };

  return null;
};

/**
 * Reading a reply that IS the answer, rather than a sentence containing one.
 *
 * ── Why this cannot be the same function ────────────────────────────────────
 *
 * Extracting from a sentence has to skip the first word: "Create John Smith"
 * starts with a capital that is a verb, and a greedy reader turns it into part
 * of the name. But when the assistant has just asked "what is their full name?"
 * and somebody types "John Adeyemi", that same skip throws away half the answer
 * and the assistant asks again — which is how a helpful exchange becomes a loop.
 *
 * So a direct reply is read permissively, and only a reply that is plainly not
 * an answer falls through to the sentence extractor.
 */
/**
 * A slot whose value can only be one of a known set — a tab, a status, a type.
 *
 * Free text is wrong for these. "export the report for last month" is not the
 * name of a tab, and putting it in the URL selects nothing while looking as
 * though something was understood. Matching against the real options means the
 * slot is either right or absent, and absent is honest.
 */
export const matchOneOf = (text, options = []) => {
  const source = clean(text).toLowerCase();
  for (const option of options) {
    const value = typeof option === 'string' ? option : option.value;
    const words = typeof option === 'string' ? [option] : (option.match || [option.value]);
    if (words.some((word) => new RegExp(`\\b${word.toLowerCase()}\\b`).test(source))) return value;
  }
  return null;
};

/**
 * A thing's given name: a property, a promotion, a plan.
 *
 * ── Why this cannot be "whatever was typed" ─────────────────────────────────
 *
 * The name slot used the plain text extractor, so "create a property called
 * Lekki Gardens" opened the form with the property named *"create a property
 * called Lekki Gardens"*. Free text is right for a reply to "what should it be
 * called?"; it is wrong for a sentence that merely CONTAINS the name.
 *
 * So the name has to be marked: quoted, or introduced by called/named/titled.
 * Anything else yields nothing, and the assistant asks — which is the correct
 * outcome, because it genuinely does not know.
 */
export const extractGivenName = (text) => {
  const source = clean(text);

  const quoted = source.match(/["“']([^"”']{2,60})["”']/);
  if (quoted) return clean(quoted[1]);

  const lead = source.match(/\b(?:called|named|titled|to be called)\s+(.{2,60}?)(?:\s*[,.;]|\s+(?:with|for|at|in|priced|costing)\b|$)/i);
  if (lead) {
    const name = clean(lead[1]);
    if (name && !/^(it|this|that|a|an|the)$/i.test(name)) return name;
  }

  return null;
};

export const DIRECT_EXTRACTORS = {
  personName: (text) => {
    const source = clean(text);
    const words = source.split(' ');
    // One to four words, each looking like a name part. Anything longer is a
    // sentence, and is handed to the sentence extractor below.
    if (words.length >= 1 && words.length <= 4
      && words.every((word) => /^[A-Za-z][\w'’.-]*$/.test(word))
      && !/^(no|skip|none|yes|ok|okay|dunno|idk)$/i.test(source)) {
      return source;
    }
    return extractName(source);
  },
  text: (text) => (clean(text) || null),
  givenName: (text) => (clean(text) || null),
};

export const EXTRACTORS = {
  givenName: extractGivenName,
  email: extractEmail,
  phone: extractPhone,
  personName: extractName,
  money: extractMoney,
  quantity: extractQuantity,
  dateRange: extractDateRange,
  text: (value) => (clean(value) || null),
};
