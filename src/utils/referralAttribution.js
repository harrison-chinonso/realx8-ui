/**
 * Carrying a referral's company/realtor attribution past a page refresh.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * A referral link used to lean entirely on a sealed `?ref=` token resolving
 * over the network (see useSharedBrand): the plain codes were only ever a
 * last-resort fallback, added to the URL solely when the server had not
 * issued a short code at all. In the ordinary case — a realtor's own link,
 * which always has one — the URL carried NOTHING plain, so whether the
 * visitor's realtor was known was purely a function of whether that one
 * network call happened to succeed. Refresh a flaky connection a few times
 * and it succeeds on some loads and not others: the "identifier" a person
 * watched appear was never persisted anywhere, it was recomputed from
 * scratch, sometimes to nothing.
 *
 * Two changes fix that together:
 *   1. The plain codes (and now the referrer's name) are ALWAYS on the link,
 *      not only when a short code could not be minted — see
 *      ReferralLinkPanel and ReferralCodeCard.
 *   2. Whatever attribution a page load DOES see — from the URL or from a
 *      sealed token that resolved — is written here, so a later load with no
 *      query string at all (a refresh that a browser or proxy stripped it
 *      from, a bookmark saved mid-flow) still has it.
 *
 * ── Why localStorage and not sessionStorage ─────────────────────────────────
 *
 * A referral code is not a secret — it is printed on the link itself, in
 * plain sight, by design. sessionStorage would lose it the moment the link is
 * opened in a fresh tab, which is the ordinary way a shared link is opened
 * (WhatsApp, email, a new browser window). localStorage survives that; the
 * expiry below is what stops it lingering forever on a shared device.
 */

const KEY = 'realx8.referral_attribution';

/** Long enough to finish a sign-up days later; short enough that a shared
 *  device is not still crediting last month's visitor. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Reads whichever of these are on the CURRENT url — the only source that is
 *  ever trusted over what was previously stored. */
export const referralParamsFromUrl = (search = window.location.search) => {
  const q = new URLSearchParams(search);
  const upper = (value) => (value ? String(value).trim().toUpperCase() : '');
  return {
    ref: q.get('ref') || null,
    company_code: upper(q.get('company_code') || q.get('code')) || null,
    company_name: q.get('company_name') || null,
    realtor_code: upper(q.get('realtor_code') || q.get('r')) || null,
    realtor_name: q.get('realtor_name') || null,
  };
};

/** Field-by-field: the URL wins wherever it has an opinion; storage fills in
 *  only what the URL left blank. A plain object spread would let a field the
 *  URL does not mention (null) overwrite one storage already had, which is
 *  backwards — the whole point is that a THIS-load-only field (say, a link
 *  with just `?ref=`, opened again without it) does not erase what an
 *  earlier load already established. */
const FIELDS = ['ref', 'company_code', 'company_name', 'realtor_code', 'realtor_name'];
const mergeAttribution = (stored, fromUrl) => Object.fromEntries(
  FIELDS.map((field) => [field, fromUrl[field] ?? stored?.[field] ?? null])
    .filter(([, value]) => value != null),
);

/** Nothing worth keeping — no company, no realtor, nothing to lose on a refresh. */
const isEmpty = (attribution) => !attribution?.company_code && !attribution?.realtor_code && !attribution?.ref;

export const saveReferralAttribution = (attribution) => {
  if (isEmpty(attribution)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...attribution, saved_at: Date.now() }));
  } catch {
    // Private browsing, or storage disabled — attribution simply will not
    // survive a refresh. The URL itself, resolved fresh, is the fallback.
  }
};

export const loadReferralAttribution = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.saved_at || 0) > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearReferralAttribution = () => {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
};

/**
 * The attribution a page should act on: whatever is in the URL right now,
 * filled in with whatever was stored from an earlier load for any field the
 * URL does not carry — never the other way around, so a stale stored value
 * can never override a link somebody just clicked.
 */
export const resolveReferralAttribution = (search = window.location.search) => {
  const fromUrl = referralParamsFromUrl(search);
  const stored = loadReferralAttribution();
  const merged = mergeAttribution(stored, fromUrl);
  // Persist the merge immediately: a URL-only visit is now durable, and a
  // storage-only visit (no query string this time) keeps its expiry moving.
  saveReferralAttribution(merged);
  return merged;
};
