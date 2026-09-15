import { Bm25Index } from './search/bm25.js';
import { tokenize, tokenizeQuery } from './search/tokenize.js';

/**
 * The assistant's answering engine.
 *
 * Synchronous, in-process and offline: a question goes in, a ranked answer
 * comes out, built from the knowledge that ships in the bundle. There is no
 * round trip, so navigation help appears instantly and keeps working whatever
 * the AI provider is doing.
 *
 * ── Deciding how sure it is, is most of the job ─────────────────────────────
 *
 * A retrieval system with no language model must never bluff. Offering three
 * plausible options is a far better failure than confidently walking somebody
 * through the wrong flow — which is what the keyword matcher this replaces did,
 * because any single word was enough to declare a winner.
 */

/**
 * What each part of a recipe is worth.
 *
 * `keywords` sits almost level with `title` on purpose: it is where the
 * colloquial phrasings live — "how do I bill someone", "where's my money" —
 * and those are exactly the questions a title-weighted index misses.
 */
const RECIPE_WEIGHTS = {
  title: 3.5,
  keywords: 3,
  summary: 1.6,
  trail: 1.4,
  category: 1.2,
  steps: 1,
};

/** Menu labels are short and deliberate; an unlinked route is weaker evidence. */
const NAV_WEIGHTS = {
  label: 3,
  trail: 2,
  section: 1.2,
  slug: 1,
};

const ACTION_WEIGHTS = {
  title: 3.5,
  keywords: 3.2,
  summary: 1.5,
  trail: 1.2,
};

/** A recipe about the part of the app somebody is already in is likelier. */
const CURRENT_SECTION_BOOST = 1.18;

/**
 * How much a full-title match can add.
 *
 * A title names the task, so the question being almost exactly a title is much
 * stronger evidence than the same words scattered through a document. This is
 * what separates "Approve a payment" from "Reject a payment".
 */
/**
 * A where-is question turns the usual ordering around: screens go ABOVE the
 * walkthroughs instead of below them. 1.6 rather than 0.8 — enough to clear a
 * recipe that merely shares vocabulary, not enough to beat one whose title the
 * question actually is.
 */
const NAV_INTENT_BOOST = 1.6;

/**
 * "Create a promotion" wants the thing that creates one.
 *
 * The walkthrough and the action describe the same task in nearly the same
 * words, so they scored within a whisker of each other and the assistant
 * offered a choice between "Create a promotion" and "Run a promotion" — a
 * distinction with no difference, put to somebody who had already said what
 * they wanted. The VERB is what separates them: an imperative asks for the
 * doing, "how do I" asks for the telling.
 */
const DO_INTENT_BOOST = 1.5;

/**
 * How close a permitted answer must be to the best overall before it is offered
 * in place of one the person may not have. Two thirds: near-synonyms like
 * "invoices" and "my invoices" clear it comfortably, while an unrelated screen
 * that merely happens to be allowed does not.
 */
const PERMITTED_RELEVANCE = 0.66;

const TITLE_COVERAGE_BOOST = 0.55;

/** Below this, the engine says it does not know rather than guessing. */
const FLOOR = 2.2;

/** The winner must beat the runner-up by this much to be offered alone. */
const CONFIDENT_RATIO = 1.45;

const slugTerms = (route) => tokenize(route.split('/').filter(Boolean).join(' '));

/**
 * Builds the searchable form of everything the assistant knows.
 *
 * Done once and reused: the corpus is static for the life of the page, and
 * re-tokenising a few hundred documents per keystroke would be felt.
 */
export const buildEngine = ({ appMap = [], recipes = [], actions = [] }) => {
  const navIndex = new Bm25Index(appMap.map((entry) => ({
    id: entry.route,
    entry,
    fields: {
      label: tokenize(entry.label || ''),
      trail: tokenize(entry.trail || ''),
      section: tokenize(entry.section || ''),
      slug: slugTerms(entry.route),
    },
  })), NAV_WEIGHTS);

  const recipeIndex = new Bm25Index(recipes.map((recipe) => ({
    id: recipe.id,
    recipe,
    fields: {
      title: tokenize(recipe.title),
      keywords: tokenize((recipe.keywords || []).join(' ')),
      summary: tokenize(recipe.summary || ''),
      trail: tokenize(recipe.trail || ''),
      category: tokenize(recipe.category || ''),
      steps: tokenize((recipe.steps || []).map((s) => `${s.text} ${s.note || ''}`).join(' ')),
    },
  })), RECIPE_WEIGHTS);

  const actionIndex = new Bm25Index(actions.map((action) => ({
    id: action.id,
    action,
    fields: {
      title: tokenize(action.title),
      keywords: tokenize((action.keywords || []).join(' ')),
      summary: tokenize(action.summary || ''),
      trail: tokenize(action.trail || ''),
    },
  })), ACTION_WEIGHTS);

  /*
   * Screen permissions by route. Recipes and actions point at a screen, and
   * reaching that screen is a precondition for the task — so the requirement is
   * looked up here rather than restated (and eventually mis-stated) on each
   * recipe.
   */
  const screens = new Map(appMap.map((entry) => [entry.route, entry]));

  return { navIndex, recipeIndex, actionIndex, appMap, recipes, actions, screens };
};

/**
 * Whether this person could actually do the thing.
 *
 * ── Permission is checked BEFORE anything is explained ──────────────────────
 *
 * The assistant used to describe a task to anybody who asked and attach a note
 * saying they could not perform it. That is the wrong way round: it walks
 * somebody through a process they will be refused at, and it discloses screens,
 * routes and procedures that the menu deliberately hides from them. Guidance is
 * now withheld unless the permission is confirmed first.
 *
 * ── What "the permission" means ─────────────────────────────────────────────
 *
 * Two things, and BOTH have to hold:
 *
 *   * whatever the SCREEN requires — taken from the generated app map, so it is
 *     the same test navConfig uses to show or hide the menu entry, and the
 *     assistant can never offer a door the menu has already closed;
 *   * whatever the TASK requires on top — viewing the invoice list needs
 *     `finance.invoices.view`, raising one needs `finance.invoices.create`, and
 *     a walkthrough for raising one must demand the second as well as the first.
 *
 * Some things are gated by ROLE rather than by a named permission — approving a
 * payment is `staffOnly` on the server, with no permission attached — so that
 * is expressible too, and checked the same way the API checks it.
 */
const isAccessible = (requirement, context) => {
  const {
    permissions = [], staffOnly = false, showForTypes = [], hideForTypes = [],
    unverified = false, superiorAdminOnly = false,
  } = requirement || {};

  /*
   * Platform-owner screens, before the unrestricted shortcut below — because
   * being unrestricted is exactly what this asks about. A company's own
   * administrator holds every permission there is and still must not be walked
   * through onboarding a new tenant.
   */
  if (superiorAdminOnly && !context.unrestricted) return false;

  // An unrestricted account (superior admin, or a wildcard grant) passes
  // everything, exactly as authStore.hasPermission treats it.
  if (context.unrestricted) return true;

  /*
   * A screen whose rules could not be established at all — a top-level path
   * with no menu entry to inherit from. There is nothing to check, so there is
   * nothing to confirm, and an unconfirmed screen is not described.
   */
  if (unverified) return false;

  /*
   * The role limits the MENU itself applies. A permission name does not
   * express "buyers only" or "not for realtors", and navConfig says both — so
   * the same two lists are honoured here, and the assistant can never offer a
   * screen the menu withholds, nor withhold one the menu offers.
   */
  const role = context.role;
  if (role && hideForTypes.includes(role)) return false;
  if (showForTypes.length && !showForTypes.includes(role)) return false;

  if (staffOnly && ['client', 'realtor'].includes(role)) return false;

  if (!permissions.length) return true;

  /*
   * No permission list supplied means nothing can be confirmed, and an
   * unconfirmed permission is a refusal. This used to return true — "do not
   * pretend to know" — which in practice meant every caller that forgot to pass
   * permissions got full guidance.
   */
  const held = context.held;
  if (!held) return false;

  return permissions.every((name) => held.has(name));
};

/** What a screen, recipe or action demands: the screen's rules plus its own. */
const requirementOf = (item, screen = {}) => ({
  permissions: [...new Set([...(screen.permissions || []), ...(item.permissions || [])])],
  staffOnly: item.staffOnly === true,
  showForTypes: screen.showForTypes || [],
  hideForTypes: screen.hideForTypes || [],
  unverified: screen.unverified === true,
  superiorAdminOnly: screen.superiorAdminOnly === true,
});

/**
 * Answer a question.
 *
 * @returns {{ kind, confidence, action?, recipe?, navigation?, alternatives }}
 *   `kind` is 'action' | 'recipe' | 'navigation' | 'unknown'.
 */
export const ask = (engine, question, context = {}) => {
  const terms = tokenizeQuery(question);
  const here = context.route || null;

  const permissions = context.permissions;
  const access = {
    held: Array.isArray(permissions) ? new Set(permissions) : null,
    // A wildcard grant is unrestricted whichever way it arrives.
    unrestricted: Boolean(context.unrestricted)
      || (Array.isArray(permissions) && permissions.includes('*')),
    role: context.role || null,
  };
  const permitted = (item, route) => isAccessible(
    requirementOf(item, engine.screens?.get(route ?? item.route) || {}),
    access,
  );

  if (!terms.length) {
    return { kind: 'unknown', confidence: 'none', alternatives: [] };
  }

  /*
   * "Where is the promotions page" is a question about a SCREEN, and the words
   * in it overlap heavily with every walkthrough that touches promotions. The
   * phrasing is the only thing that distinguishes them, so it is used: an
   * explicit where-is/take-me-to opening lifts screens above the prose.
   */
  const navIntent = /^\s*(where\s+(is|are|do i find|can i find)|take me to|open the|go to|find the)\b/i.test(question);

  /*
   * An imperative opening — and NOT "how do I create…", which is a request for
   * the walkthrough and is excluded by requiring the verb to come first.
   */
  const doIntent = /^\s*(create|add|set ?up|new|make|register|start|build|raise|draft)\b/i.test(question);

  /** A recipe or action whose title the question nearly IS, scores higher. */
  const withCoverage = (hit, titleTerms) => {
    if (!titleTerms.length) return hit.score;
    const matched = titleTerms.filter((term) => terms.includes(term)).length;
    const coverage = matched / titleTerms.length;
    return hit.score * (1 + (coverage * TITLE_COVERAGE_BOOST));
  };

  const actionHits = engine.actionIndex.search(terms).map((hit) => ({
    kind: 'action',
    action: hit.document.action,
    score: withCoverage(hit, hit.document.fields.title) * (doIntent ? DO_INTENT_BOOST : 1),
    accessible: permitted(hit.document.action),
  }));

  const recipeHits = engine.recipeIndex.search(terms).map((hit) => {
    const recipe = hit.document.recipe;
    let score = withCoverage(hit, hit.document.fields.title);
    // Already in that part of the app? Then this is likelier to be what they mean.
    if (here && recipe.route && here.startsWith(recipe.route.split('?')[0])) {
      score *= CURRENT_SECTION_BOOST;
    }
    return {
      kind: 'recipe',
      recipe,
      score,
      accessible: permitted(recipe),
    };
  });

  const navHits = engine.navIndex.search(terms).map((hit) => ({
    kind: 'navigation',
    entry: hit.document.entry,
    /*
     * Screens are scored BELOW recipes and actions of similar strength. "How do
     * I raise an invoice" should produce the walkthrough, not a link to the
     * invoices list — the link is what somebody falls back to when there is no
     * walkthrough.
     */
    score: hit.score * (navIntent ? NAV_INTENT_BOOST : 0.8),
    accessible: permitted(hit.document.entry, hit.document.entry.route),
  }));

  const scored = [...actionHits, ...recipeHits, ...navHits].sort((a, b) => b.score - a.score);

  /*
   * What this person CAN do is answered first.
   *
   * "Where are my invoices", asked by a buyer, matched the staff invoice list
   * more strongly than the buyer's own My Invoices — so a strict gate turned a
   * perfectly answerable question into a refusal, with the right answer sitting
   * second. Refusing is only correct when there is nothing they may be told.
   *
   * So the permitted hits are ranked on their own, and the full list is kept
   * only to recognise a question whose every answer is out of bounds — which is
   * a refusal, and is not the same as not understanding.
   */
  const permittedHits = scored.filter((hit) => hit.accessible);

  /*
   * ...but only when the permitted answer is genuinely close to what was asked.
   *
   * Without this, a buyer typing "create a user" got "did you mean: Pay an
   * invoice?" — the strongest thing they were allowed, which had almost nothing
   * to do with the question. When the best permitted hit is far weaker than the
   * best overall, the question really is about the forbidden thing, and the
   * honest reply is that they cannot do it rather than a suggestion they did
   * not ask for.
   */
  const usePermitted = permittedHits.length
    && permittedHits[0].score >= FLOOR
    && permittedHits[0].score >= scored[0].score * PERMITTED_RELEVANCE;

  let ranked = usePermitted ? permittedHits : scored;

  /*
   * "Where is X" asked for a PAGE, so a page is what it gets.
   *
   * A weight alone was not enough to settle this. Adding five recipes shifted
   * the IDF across the whole recipe corpus, the promotions walkthrough drifted
   * past the Promotions screen, and "where is the promotions page" started
   * offering a choice between an article and the page itself. Which KIND of
   * answer was asked for is not a matter of degree, so it is not decided by
   * scores that move whenever the corpus does — a screen that is a credible
   * match simply wins.
   */
  if (navIntent) {
    const screens = ranked.filter((hit) => hit.kind === 'navigation');
    if (screens.length && screens[0].score >= FLOOR
      && screens[0].score >= ranked[0].score * PERMITTED_RELEVANCE) {
      ranked = [...screens, ...ranked.filter((hit) => hit.kind !== 'navigation')];
    }
  }

  if (!ranked.length || ranked[0].score < FLOOR) {
    return {
      kind: 'unknown',
      confidence: 'none',
      // Even when unsure, the nearest few are worth offering — they are usually
      // what the person meant, phrased differently.
      alternatives: ranked.slice(0, 3),
    };
  }

  const [best, next] = ranked;

  /*
   * What counts as a rival depends on what was asked.
   *
   * "Where is the promotions page" put the Promotions screen on top with a
   * promotions walkthrough a hair behind — and calling that ambiguous produced
   * "did you mean one of these: Promotions, How to run a promotion", which is
   * not a real choice. They asked where a page is and we know where it is.
   *
   * The only genuine ambiguity for a where-is question is between two SCREENS —
   * /finance/invoices and /finance/my-invoices really are different answers to
   * "take me to invoices", and offering both is right.
   */
  /*
   * The rival is a hit of the same KIND. Asked to create something, the only
   * real question is WHICH action; asked where a screen is, which screen. A
   * walkthrough sitting just behind either one is not a competing answer.
   */
  const sameKindRival = (kind) => ranked.slice(1).find((hit) => hit.kind === kind);
  const rival = (navIntent && best.kind === 'navigation') || (doIntent && best.kind === 'action')
    ? sameKindRival(best.kind)
    : next;

  const confident = !rival || best.score >= rival.score * CONFIDENT_RATIO;

  return {
    ...best,
    confidence: confident ? 'high' : 'low',
    /*
     * When it is not confident, the runners-up are the answer: "did you mean
     * one of these" is honest, and a person picks correctly in one click.
     */
    alternatives: confident ? [] : ranked.slice(1, 4),
  };
};
