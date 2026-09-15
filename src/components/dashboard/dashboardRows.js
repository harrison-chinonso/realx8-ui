/**
 * How many rows a dashboard list shows.
 *
 * ── Why one number, and why five ────────────────────────────────────────────
 *
 * A dashboard answers "what needs me now". Every list on it competes for the
 * same screen, and a panel showing ten rows pushes the next panel below the
 * fold — so the eleventh most urgent invoice costs you sight of the support
 * queue entirely. Five is enough to show the shape of a list and short enough
 * that several fit together.
 *
 * The lists were capped at eight, six and ten in three different places, which
 * is not a decision anybody made — it is three people picking a number. One
 * constant means the next person changes it once.
 *
 * ── The cap belongs in the component ────────────────────────────────────────
 *
 * Not in the data layer. Whoever fetches may legitimately want more — an export
 * takes the whole set, and a detail page shows everything — so the list is
 * fetched as it is and trimmed where it is drawn. Any caller that needs a
 * different number passes `limit`.
 */
export const DASHBOARD_ROWS = 5;

/** The first `limit` of a list, safely for anything that is not an array. */
export const capRows = (rows, limit = DASHBOARD_ROWS) => (
  Array.isArray(rows) ? rows.slice(0, limit) : []
);
