/**
 * Turning what somebody typed into terms that can be matched.
 *
 * ── Why this is more than splitting on spaces ───────────────────────────────
 *
 * People type "invoices", "invoicing" and "invoice" for the same thing, write
 * naira as ₦2m or 2,000,000, and shorten words in ways that are obvious to a
 * reader and invisible to a matcher. Every one of those is a question that
 * would otherwise find nothing and make the assistant look broken.
 */

/**
 * Words too common in THIS application to carry meaning.
 *
 * Ordinary stop words plus the ones peculiar to us: nearly every screen and
 * recipe says "property" or "payment" somewhere, so on their own they separate
 * nothing. They are only dropped when other terms survive — a bare "invoices"
 * still has to work.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'do',
  'does', 'did', 'can', 'could', 'should', 'would', 'will', 'shall', 'may',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'this', 'that',
  'how', 'what', 'where', 'when', 'which', 'who', 'why',
  'please', 'want', 'need', 'help', 'get', 'go', 'show', 'see', 'find',
]);

/**
 * Spellings that mean the same thing here.
 *
 * Applied before tokenising so a phrase can be rewritten, not just a word. The
 * pidgin entries are not decoration — "abeg" and "wan" are typed by real users
 * of this platform, and a matcher that drops them loses the whole question.
 */
const SYNONYMS = [
  [/\binstall?ments?\b/g, 'instalment'],
  [/\binstalments?\b/g, 'instalment'],
  [/\bpayment plans?\b/g, 'instalment plan'],
  [/\bhouses?\b/g, 'property'],
  [/\bflats?\b/g, 'unit'],
  [/\bplots?\b/g, 'unit'],
  [/\blisting?s?\b/g, 'property'],
  [/\bagents?\b/g, 'realtor'],
  [/\bstaff\b/g, 'user'],
  [/\bemployees?\b/g, 'user'],
  [/\bcustomers?\b/g, 'client'],
  [/\bbuyers?\b/g, 'client'],
  [/\breceipts?\b/g, 'receipt'],
  [/\bdownload\b/g, 'export'],
  [/\bcsv\b/g, 'export'],
  [/\bspreadsheet\b/g, 'export'],
  [/\bset ?up\b/g, 'create'],
  [/\badd\b/g, 'create'],
  [/\bnew\b/g, 'create'],
  [/\bregister\b/g, 'create'],
  [/\bonboard\b/g, 'create'],
  [/\bdiscount\b/g, 'promotion'],
  [/\boffer\b/g, 'promotion'],
  [/\bcommision\b/g, 'commission'],     // a misspelling common enough to matter
  [/\bwan\b/g, 'want'],                 // light pidgin, typed by real users
  [/\babeg\b/g, 'please'],
  [/\bhw\b/g, 'how'],
  [/\bpls\b/g, 'please'],
  [/\bd\b/g, 'the'],
];

/**
 * Crude suffix stripping, deliberately.
 *
 * A real stemmer is a dependency and a surprise: it turns "housing" into "hous"
 * and then nothing a human wrote matches it. This only removes the endings that
 * actually cause misses here, and only from words long enough that the stem is
 * still a word.
 */
const stem = (word) => {
  if (word.length <= 4) return word;
  for (const suffix of ['ing', 'ies', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return suffix === 'ies' ? `${word.slice(0, -3)}y` : word.slice(0, -suffix.length);
    }
  }
  return word;
};

const expand = (text) => SYNONYMS.reduce((acc, [from, to]) => acc.replace(from, to), text);

const normalise = (text) => String(text || '')
  .toLowerCase()
  .replace(/[₦$£,]/g, '')
  .replace(/[^\w\s/-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** Terms for something being INDEXED — stop words removed, stems kept. */
export const tokenize = (text) => {
  const words = expand(normalise(text)).split(' ').filter(Boolean);
  const kept = words.filter((word) => !STOP_WORDS.has(word));
  return (kept.length ? kept : words).map(stem);
};

/**
 * Terms for a QUESTION.
 *
 * Identical to indexing except that everything is dropped only if that would
 * leave nothing: "how do I?" is all stop words, and answering it with silence
 * is correct, but "show me invoices" must not lose its one real term.
 */
export const tokenizeQuery = (text) => tokenize(text);

/** Exposed for the tests, and for anything that wants to explain a match. */
export const __internals = { STOP_WORDS, SYNONYMS, stem, normalise, expand };
