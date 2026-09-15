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
 * `--rx-accent` is the only value a tenant controls, and it is used in exactly
 * two places: the focus ring, and the icon container on hover. Everything else
 * is a fixed neutral ramp.
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
  --rx-surface: #FFFFFF;
  --rx-surface-2: #F5F5F2;
  --rx-surface-3: #EAEAE6;
  --rx-ink: #16181A;
  --rx-ink-2: #5A5F63;
  --rx-ink-3: #8B9095;
  --rx-rule: #E4E4E0;
}

/* ── Panel: sized by its contents, not by the viewport ──────────────────── */
.rx-panel {
  background: var(--rx-surface);
  border-radius: 14px;
  box-shadow: 0 24px 60px -20px rgba(22, 24, 26, .28), 0 0 0 1px var(--rx-rule);
  width: 100%;
  max-width: 1060px;
  max-height: calc(100vh - 6rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Search row ─────────────────────────────────────────────────────────── */
.rx-search {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--rx-rule);
}
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
  padding: 10px 18px;
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
.rx-chip:hover { color: var(--rx-ink); border-color: var(--rx-ink-3); }

/* ── Body ───────────────────────────────────────────────────────────────── */
.rx-body { overflow-y: auto; padding: 16px 18px 20px; }

/* Group header: label, hairline filling the width, count. */
.rx-group + .rx-group { margin-top: 20px; }
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
  position: relative;
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
  padding: 22px 10px 16px;
  /*
   * A floor, so every tile is the same height.
   *
   * Grid rows size themselves independently: a group whose descriptions wrap
   * to two lines produced taller tiles than one whose did not, and the pattern
   * has exactly one rule it will not bend on — no tile heavier than another.
   */
  min-height: 158px;
  background: var(--rx-surface-2);
  border: 1px solid transparent;
  border-radius: 11px;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: background-color .12s ease, border-color .12s ease;
}
.rx-tile:hover { background: var(--rx-surface); border-color: var(--rx-rule); }
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
  /*
   * Two lines, and the tile is tall enough for two whether or not they are
   * used. "Visitor Log & Attendance" wraps where "Finance" does not, and a
   * grid row sizes to its tallest member — so one long name made a whole group
   * of tiles heavier than the rest. Reserving the space costs a few pixels on
   * every tile and keeps the one rule the pattern will not bend on.
   */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
  /* Exactly two lines of space, used or not — see the tile height note. */
  min-height: 2.5em;
}
.rx-desc {
  font: 400 11px/1.3 system-ui, sans-serif; color: var(--rx-ink-3);
  max-width: 14ch;
  /*
   * Both text blocks reserve two lines, so every tile is the same height by
   * construction rather than by a floor that has to be re-tuned each time a
   * label changes. Chasing it with min-height took three attempts and was
   * still wrong for the one module whose name AND description both wrap.
   */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.6em;
}

/* The slot key, on hover only — texture when wanted, silence when not. */
.rx-slot {
  position: absolute; top: 7px; right: 8px;
  font: 500 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--rx-ink-3);
  opacity: 0;
  transition: opacity .12s ease;
}
.rx-tile:hover .rx-slot, .rx-tile:focus-visible .rx-slot { opacity: 1; }

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
  .rx-panel { max-width: none; width: 100%; height: 100%; max-height: none; border-radius: 0; }
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
  /* Shorter, because the description that justified the height is gone. */
  .rx-tile { min-height: 112px; padding: 16px 8px 12px; }
  /* A description is a luxury at this width; the name is not. */
  .rx-desc, .rx-keys { display: none; }
  .rx-body { padding: 12px 12px 18px; }
  .rx-search, .rx-recent { padding-left: 12px; padding-right: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .rx-tile, .rx-ic, .rx-slot { transition: none; }
}
`;
