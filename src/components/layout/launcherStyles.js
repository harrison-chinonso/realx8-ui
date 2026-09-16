/**
 * The launcher's own stylesheet, injected while it is open.
 *
 * ── Why CSS rather than utility classes ─────────────────────────────────────
 *
 * Almost everything here is a hover or focus state on a nested element — the
 * tile changing while the icon container inside it changes differently. Written
 * as utilities that is a thicket of `group-hover:` prefixes repeated on every
 * tile; written as eight rules it is legible, and the relationship between the
 * two surfaces is stated once.
 *
 * ── One themeable token ─────────────────────────────────────────────────────
 *
 * `--rx-accent` is the only value a tenant controls. It appears on the rule
 * across the top of the page, the focus ring, the icon container on hover, and
 * — at well under half strength — the tile and chip borders on hover.
 * Everything else is a fixed neutral ramp.
 *
 * The rule that keeps this safe is not "use it twice", it is that the accent
 * never carries text on a page background and never distinguishes one tile
 * from another. Where it does sit under a glyph, the glyph colour is picked
 * from its luminance at runtime. Widening its use within that rule costs
 * nothing; stepping outside it is what has to be re-checked per tenant.
 *
 * That is not squeamishness about colour — it is what a white-label product
 * requires. A design that carries meaning in hue has to be re-checked against
 * every tenant palette, and the ones that break are found by customers. Tested
 * at both ends: #FF00AA and #CCCCCC. Neither can break contrast here, because
 * neither is ever asked to carry text on a page background or to distinguish
 * one tile from another.
 */
export const LAUNCHER_CSS = `
.rx-launcher {
  --rx-accent: var(--primary, #2563eb);
  /* The same colour as r, g, b, so it can be mixed at low opacity for the
     tints and hairlines below. Set by AppearanceContext alongside --primary,
     and already the idiom the rest of the app uses (see Alert.jsx). */
  --rx-accent-rgb: var(--primary-rgb, 37, 99, 235);
  --rx-surface: #FFFFFF;
  --rx-surface-2: #F5F5F2;
  --rx-surface-3: #EAEAE6;
  --rx-ink: #16181A;
  --rx-ink-2: #5A5F63;
  --rx-ink-3: #8B9095;
  --rx-rule: #E4E4E0;
}

/* ── Panel: the whole viewport ──────────────────────────────────────────────
 *
 * It was a 1060px card floating on a dimmed page — radius, drop shadow, a
 * margin all round. That reads as a dialog: something you have interrupted
 * your work with and will dismiss. The menu is not an interruption on this
 * template, it is the only way to navigate, and it is now the first thing seen
 * after signing in. So it takes the full screen and reads as a destination.
 *
 * Full bleed, but not full measure — see the content column below.
 */
.rx-panel {
  background: var(--rx-surface);
  /* The one piece of brand on the page, and the only accent that is always
     visible rather than waiting for a hover. Decoration carries no text, so
     any tenant colour is safe here at any luminance. */
  border-top: 3px solid var(--rx-accent);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/*
 * The content column.
 *
 * Full bleed is right for the surface and wrong for the contents: at 2560px a
 * grid of 158px tiles becomes fifteen columns, and the eye has no line to come
 * back to. The padding grows to hold the content to a measure and centre it,
 * while the rules above and below it still run the width of the screen — which
 * is what makes it read as a page rather than a stretched card.
 *
 * 1060px is the width the panel itself used to be, chosen when the grid was
 * tuned. Keeping it means only the SURFACE became a page: the tiles sit at the
 * same size, in the same six columns, in the same relationship to each other
 * as before. Widening the measure to suit the new canvas was the obvious move
 * and the wrong one — at 1180px a group of three tiles sat in a seven-column
 * grid, and the extra column of nothing was the first thing the eye found.
 */
.rx-search, .rx-recent, .rx-body {
  padding-inline: max(18px, calc((100% - 1060px) / 2));
}

/* ── Search row ─────────────────────────────────────────────────────────── */
.rx-search {
  display: flex; align-items: center; gap: 12px;
  padding-block: 14px;
  border-bottom: 1px solid var(--rx-rule);
  transition: border-color .12s ease;
}
/* Typing is the fastest route through this screen; the rule under the row
   picks up the brand while it has the caret. Border only — an accent that
   never carries text cannot fail a contrast check. */
.rx-search:focus-within { border-bottom-color: var(--rx-accent); }
.rx-search input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
  font-size: 16px; color: var(--rx-ink);
}
.rx-search input::placeholder { color: var(--rx-ink-3); }

/* Keycaps: texture, and a signal that the overlay is driven from the keyboard. */
.rx-keys { display: flex; gap: 5px; }
.rx-key {
  font: 500 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--rx-ink-3);
  background: var(--rx-surface-2);
  border: 1px solid var(--rx-rule);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 4px 5px;
  white-space: nowrap;
}

/* ── Recent strip: gives the old dead space a job ───────────────────────── */
.rx-recent {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding-block: 10px;
  background: var(--rx-surface-2);
  border-bottom: 1px solid var(--rx-rule);
}
.rx-recent-label {
  font: 500 10px/1 system-ui, sans-serif; letter-spacing: .08em;
  text-transform: uppercase; color: var(--rx-ink-3);
}
.rx-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--rx-surface);
  border: 1px solid var(--rx-rule);
  border-radius: 999px;
  padding: 4px 10px 4px 7px;
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--rx-ink-2);
  text-decoration: none;
}
.rx-chip:hover {
  color: var(--rx-ink);
  border-color: rgba(var(--rx-accent-rgb), .45);
  background: rgba(var(--rx-accent-rgb), .06);
}

/* ── Body ───────────────────────────────────────────────────────────────── */
.rx-body { flex: 1; overflow-y: auto; padding-block: 18px 26px; }

/* Group header: label, hairline filling the width, count. */
/* Twelve rows now rather than four, so they need a little more air between
   them than they did — the heading is the only thing separating one menu's
   screens from the next one's. */
.rx-group + .rx-group { margin-top: 26px; }
.rx-group-head {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 9px;
}
.rx-group-head span:first-child {
  font: 600 11px/1 system-ui, sans-serif; letter-spacing: .04em;
  color: var(--rx-ink-2); white-space: nowrap;
}
.rx-group-head i { flex: 1; height: 1px; background: var(--rx-rule); }
.rx-group-head span:last-child {
  font: 500 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--rx-ink-3);
}

.rx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: 9px;
}

/* ── Tile: filled at rest, outlined on hover ────────────────────────────── */
.rx-tile {
  display: flex; flex-direction: column; align-items: center;
  /*
   * Anchored to the top, not centred.
   *
   * Centring a stack of variable height moves the icon: a tile whose name wraps
   * to two lines, or whose description does, pulls its icon upward. Measured
   * across one row that was 15px of drift — enough that the icons stopped
   * reading as a line and started reading as a mistake. Anchoring puts every
   * icon at the same height and lets the text below it vary, which is the only
   * part that can afford to.
   */
  justify-content: flex-start;
  gap: 8px;
  padding: 18px 10px 14px;
  /*
   * A floor, so every tile is the same height.
   *
   * Grid rows size themselves independently, so without this a row holding one
   * two-line name is taller than a row that does not — and the pattern has
   * exactly one rule it will not bend on: no tile heavier than another.
   *
   * 116px rather than 158px. The tile used to reserve two lines for a name and
   * two more for a description; there is no description now, so forty-two
   * pixels of it were empty. On a page showing sixty-one of them that is most
   * of a screen of nothing.
   */
  min-height: 116px;
  background: var(--rx-surface-2);
  border: 1px solid transparent;
  border-radius: 11px;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: background-color .12s ease, border-color .12s ease;
}
/* The border was a neutral hairline; it now carries the accent at just over a
   third, which is enough to tie the hover to the brand and far too little for
   hue to be carrying any meaning. */
.rx-tile:hover { background: var(--rx-surface); border-color: rgba(var(--rx-accent-rgb), .38); }
.rx-tile:focus-visible { outline: 2px solid var(--rx-accent); outline-offset: 2px; }

/*
 * The icon container is LIGHTER than the tile it sits in — an inversion of the
 * usual relationship, and what stops twelve filled rectangles reading as one
 * grey mass. Its radius is 9px against the tile's 11px: two pixels tighter, so
 * the shapes read as nested rather than repeated.
 */
.rx-ic {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px;
  background: var(--rx-surface);
  border-radius: 9px;
  color: var(--rx-ink-2);
  transition: background-color .12s ease, color .12s ease;
}
.rx-tile:hover .rx-ic {
  background: var(--rx-accent);
  /*
   * NOT hard-coded white.
   *
   * A tenant accent can be anything, and a white glyph on a pale one (#CCCCCC
   * was the case that proved it) sits at about 1.6:1 — invisible. The glyph
   * colour is chosen from the accent's luminance when the launcher opens, so
   * "any tenant colour" is a promise that actually holds rather than one that
   * holds for the dark half of the range.
   */
  color: var(--rx-on-accent, #fff);
}

.rx-name {
  font: 600 13px/1.25 system-ui, sans-serif; color: var(--rx-ink);
  max-width: 15ch;
  /*
   * Two lines, reserved whether or not they are used. "Commission Statements"
   * wraps where "Invoices" does not, and a grid row sizes to its tallest
   * member — so one long name made a whole row of tiles heavier than the rest.
   * Reserving the space is what makes every tile the same height by
   * construction, rather than by a floor that needs re-tuning whenever a label
   * changes. Chasing that with min-height alone took three attempts and was
   * still wrong for the one screen whose name wrapped.
   */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.5em;
}

.rx-empty { padding: 42px 0; text-align: center; font-size: 13px; color: var(--rx-ink-3); }

/* ── Phone: full-bleed, tighter, and the second tier of type goes ───────── */
/*
 * The phone treatment stops at 520px, not 640px.
 *
 * Two columns have to fill whatever width they are given, and between 520 and
 * 640 that produced tiles 304px wide and 112 tall — a letterbox, not a tile.
 * Above 520 there is room for the three-column desktop grid at its proper
 * proportions, so that is where the switch belongs.
 */
@media (max-width: 519px) {
  /*
   * Two columns, stated rather than derived.
   *
   * auto-fill with a 112px minimum gave three on a 390px phone and two on a
   * 360px one — so the layout changed between two handsets of the same size,
   * which is the sort of inconsistency nobody can report but everybody notices.
   * Two is the floor the pattern specifies, so two is what it says, at every
   * width below the breakpoint.
   */
  .rx-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .rx-ic { width: 38px; height: 38px; }
  .rx-tile { min-height: 104px; padding: 14px 8px 11px; }
  .rx-keys { display: none; }
  .rx-body { padding: 12px 12px 18px; }
  .rx-search, .rx-recent { padding-left: 12px; padding-right: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .rx-tile, .rx-ic, .rx-search { transition: none; }
}
`;
