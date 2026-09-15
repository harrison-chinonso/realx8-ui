/**
 * The last few screens this person actually opened.
 *
 * ── Why this is worth storing ───────────────────────────────────────────────
 *
 * Most launcher visits are a return trip: the same two or three screens, many
 * times a day. A grid answers that in a scan; a row of chips answers it in a
 * glance and one click, and it gives the strip of space under the search box a
 * job instead of leaving it blank.
 *
 * ── Why only the route is stored ────────────────────────────────────────────
 *
 * An icon is a React component and a label can be renamed, so storing either
 * would mean a chip that outlives the screen it names — a stale label pointing
 * somewhere that has moved. Only the path is kept, and everything else is
 * resolved against the live menu at render time. A route that no longer exists
 * simply stops appearing.
 *
 * ── Why localStorage and not the server ─────────────────────────────────────
 *
 * It is a convenience, not a record. Nobody needs it to survive a new laptop,
 * nobody should be able to read it from another account, and a round trip to
 * fetch it would make the launcher slower to open than it is to use.
 */

const KEY = 'realx8-recent-screens';
const LIMIT = 5;

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw.filter((path) => typeof path === 'string') : [];
  } catch {
    // A corrupted value is not worth a broken launcher.
    return [];
  }
};

/** Record a visit, most recent first, without duplicates. */
export const rememberVisit = (item) => {
  const path = item?.to;
  if (!path) return;
  try {
    const next = [path, ...read().filter((existing) => existing !== path)].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing, a full quota — losing the history is not worth an error.
  }
};

/**
 * The stored paths, resolved against what this person can currently reach.
 *
 * Resolving rather than trusting is the point: a screen they have lost access
 * to, or one that has been removed, must not appear as a chip that refuses them
 * when clicked.
 */
export const recentVisits = (destinations = []) => {
  const byPath = new Map(destinations.map((item) => [item.to, item]));
  return read().map((path) => byPath.get(path)).filter(Boolean);
};
