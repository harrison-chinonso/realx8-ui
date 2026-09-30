/**
 * The launcher's own stylesheet, injected while it is open.
 *
 * ── Why CSS rather than utility classes ─────────────────────────────────────
 *
 * Almost everything here is a state on a nested element — the card lifting
 * while its chevron moves and its icon tile shades — and the colours are all
 * custom properties set per card. Written as utilities that is a thicket of
 * arbitrary values repeated on every card; written as rules the relationships
 * are stated once.
 *
 * ── Where colour comes from ─────────────────────────────────────────────────
 *
 * Nothing here names a brand colour. Two sets of tokens arrive from JS:
 *
 *   --rx-hero-*, --rx-banner*, --rx-badge-*, --rx-focus
 *       the company's primary and secondary, set on the panel
 *   --rx-card-*
 *       one module's colour from the company's launcher palette, set on each
 *       card (launcherPalette.accentStyle)
 *
 * Every one arrives with the ink that reads on it, chosen by contrast rather
 * than assumed, so a pale palette or a near-white primary stays legible. The
 * neutrals below are the only fixed values.
 */
export const LAUNCHER_CSS = `
.rx-launcher {
  --rx-ink: #0f172a;
  --rx-ink-2: #475569;
  --rx-ink-3: #94a3b8;
  --rx-rule: #e2e8f0;
  --rx-page: #f8fafc;
  /* Defaults until ModuleLauncher sets the real ones on the panel. */
  --rx-hero-a: var(--primary, #1e3a8a);
  --rx-hero-b: var(--secondary, #0f172a);
  --rx-on-hero: #fff;
  --rx-banner: var(--secondary, #0f172a);
  --rx-banner-2: var(--primary, #1e3a8a);
  --rx-on-banner: #fff;
  --rx-badge-bg: var(--primary, #1e3a8a);
  --rx-on-badge: #fff;
  --rx-focus: var(--primary, #1e3a8a);
}

/* ── Panel: the whole viewport, one scrolling page ───────────────────────────
 *
 * The launcher is the only way to navigate on this template and the first
 * thing seen after signing in, so it is a destination rather than a dialog.
 * The header stays put; everything under it scrolls as one page, the way the
 * design reads on a phone.
 */
.rx-panel {
  background: var(--rx-page);
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.rx-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }

/* The content column: full bleed surfaces, a readable measure inside them. */
.rx-hero-row, .rx-search, .rx-content, .rx-footer {
  width: 100%; max-width: 1240px; margin-inline: auto;
  padding-inline: clamp(16px, 3vw, 32px);
  box-sizing: border-box;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.rx-hero {
  position: relative; flex-shrink: 0; overflow: hidden;
  background: linear-gradient(120deg, var(--rx-hero-a) 0%, var(--rx-hero-b) 100%);
  color: var(--rx-on-hero);
  padding: 14px 0 38px;
}
/* The sweep across the bottom edge: decoration in the ink at low strength,
   so it follows whichever ink the brand colour carries. */
.rx-hero::after {
  content: ""; position: absolute; left: -10%; right: -10%; bottom: -60px; height: 110px;
  border-radius: 50%;
  background: color-mix(in srgb, currentColor 6%, transparent);
  pointer-events: none;
}
.rx-hero-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; position: relative; z-index: 1; }
.rx-hero a { color: inherit; text-decoration: none; }

.rx-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
.rx-brand-logo { height: 40px; width: 40px; object-fit: contain; border-radius: 10px; }
.rx-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  height: 40px; width: 40px; border-radius: 12px;
  background: color-mix(in srgb, currentColor 18%, transparent);
  font: 800 20px/1 var(--font-heading, system-ui), sans-serif;
}
.rx-brand-name {
  font: 800 clamp(20px, 2.4vw, 28px)/1 var(--font-heading, system-ui), sans-serif;
  letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.rx-hero-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.rx-hero-btn {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; border-radius: 12px; color: inherit;
}
.rx-hero-btn svg { width: 24px; height: 24px; }
.rx-hero-btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
.rx-hero-count {
  position: absolute; top: 2px; right: 1px;
  min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px;
  background: #e11d48; color: #fff; font: 700 11px/19px system-ui, sans-serif; text-align: center;
  box-shadow: 0 0 0 2px var(--rx-hero-a);
}
.rx-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 46px; height: 46px; border-radius: 999px;
  border: 2px solid color-mix(in srgb, currentColor 55%, transparent);
  font: 700 15px/1 var(--font-ui, system-ui), sans-serif; letter-spacing: .02em;
}
.rx-avatar:hover { background: color-mix(in srgb, currentColor 12%, transparent); }

/* ── Search: a pill lifted over the bottom of the header ─────────────────── */
.rx-search {
  display: flex; align-items: center; gap: 12px;
  margin-top: -28px; position: relative; z-index: 2;
  flex-shrink: 0;
}
.rx-search > * { flex-shrink: 0; }
.rx-search::before {
  /* The pill itself, drawn behind the row so the row keeps the column's
     padding and the pill still reaches its edges. */
  content: ""; position: absolute; inset: 0 clamp(16px, 3vw, 32px);
  background: #fff; border-radius: 18px;
  box-shadow: 0 10px 30px -12px rgba(15, 23, 42, .35), 0 0 0 1px rgba(15, 23, 42, .04);
  z-index: -1;
  transition: box-shadow .15s ease;
}
.rx-search:focus-within::before { box-shadow: 0 10px 30px -12px rgba(15, 23, 42, .35), 0 0 0 2px var(--rx-focus); }
.rx-search-icon { color: var(--rx-ink-2); margin-left: 18px; }
.rx-search-back { margin-left: 12px; color: var(--rx-ink-2); }
.rx-search-back + .rx-search-icon { margin-left: 0; }
.rx-search input {
  flex: 1 1 auto; min-width: 0; height: 60px; border: 0; outline: 0; background: transparent;
  font: 400 17px/1 var(--font-ui, system-ui), sans-serif; color: var(--rx-ink);
}
.rx-search input::placeholder { color: var(--rx-ink-2); }
.rx-keys { display: flex; gap: 5px; margin-right: 16px; }
.rx-key {
  font: 500 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--rx-ink-2); background: var(--rx-page);
  border: 1px solid var(--rx-rule); border-radius: 8px; padding: 6px 7px;
}

/* ── Content ─────────────────────────────────────────────────────────────── */
.rx-content { flex: 1; padding-block: 22px 28px; display: flex; flex-direction: column; gap: 20px; }

/* ── Welcome banner ──────────────────────────────────────────────────────── */
.rx-banner {
  position: relative; overflow: hidden;
  display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  min-height: 168px; border-radius: 20px;
  background: linear-gradient(100deg, var(--rx-banner) 0%, var(--rx-banner) 42%, var(--rx-banner-2) 100%);
  color: var(--rx-on-banner);
  box-shadow: 0 14px 30px -18px rgba(15, 23, 42, .55);
}
.rx-banner-text { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 6px; padding: 26px 0 26px 30px; }
.rx-banner-kicker { font: 600 12px/1 var(--font-ui, system-ui), sans-serif; letter-spacing: .14em; text-transform: uppercase; opacity: .85; }
.rx-banner-name { font: 800 clamp(24px, 3.1vw, 36px)/1.1 var(--font-heading, system-ui), sans-serif; letter-spacing: -.01em; }
.rx-banner-lead { font: 400 clamp(14px, 1.2vw, 16px)/1.45 var(--font-body, system-ui), sans-serif; opacity: .92; max-width: 42ch; margin-top: 4px; }
.rx-banner-art { position: relative; }
/* The picture fades into the banner colour on its left, so the words beside
   it always sit on the solid part — the part their ink was chosen against. */
.rx-banner-art img, .rx-banner-art svg {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 38%);
          mask-image: linear-gradient(to right, transparent 0%, #000 38%);
}
.rx-banner-art svg { object-fit: contain; opacity: .55; padding: 18px 18px 0; box-sizing: border-box; }
.rx-banner-badge {
  position: absolute; right: 16px; bottom: 14px; z-index: 1;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 16px; border-radius: 999px;
  background: var(--rx-badge-bg); color: var(--rx-on-badge);
  font: 600 13px/1 var(--font-ui, system-ui), sans-serif;
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .5);
}
.rx-bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 13px; }
.rx-bars i { width: 3px; background: currentColor; border-radius: 1px; }
.rx-bars i:nth-child(1) { height: 5px; } .rx-bars i:nth-child(2) { height: 9px; } .rx-bars i:nth-child(3) { height: 13px; }

/* ── Recent ──────────────────────────────────────────────────────────────── */
.rx-recent { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rx-recent-label {
  font: 600 11px/1 var(--font-ui, system-ui), sans-serif; letter-spacing: .08em;
  text-transform: uppercase; color: var(--rx-ink-2); margin-right: 2px;
}
.rx-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid var(--rx-rule); border-radius: 999px;
  padding: 6px 12px 6px 9px;
  font: 500 13px/1 var(--font-ui, system-ui), sans-serif; color: var(--rx-ink-2); text-decoration: none;
}
.rx-chip:hover { color: var(--rx-ink); border-color: var(--rx-focus); }

/* ── Group heading inside a module or in search results ──────────────────── */
.rx-group-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.rx-group-head span:first-child { font: 700 15px/1.2 var(--font-heading, system-ui), sans-serif; color: var(--rx-ink); }
.rx-group-head i { flex: 1; height: 1px; background: var(--rx-rule); }
.rx-group-head span:last-child { font: 500 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--rx-ink-2); }

/* ── Module cards ─────────────────────────────────────────────────────────── */
.rx-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(12px, 1.4vw, 20px);
}
@media (max-width: 1199px) { .rx-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 859px)  { .rx-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.rx-card {
  position: relative;
  display: flex; flex-direction: column; gap: 12px;
  min-height: 176px; padding: 20px 20px 18px; box-sizing: border-box;
  border-radius: 20px;
  background: linear-gradient(160deg, #fff 0%, var(--rx-card-tint) 55%);
  border: 1px solid var(--rx-card-edge);
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
.rx-card:hover {
  transform: translateY(-2px);
  border-color: var(--rx-card-fill);
  box-shadow: 0 14px 28px -18px var(--rx-card-fill);
}
.rx-card:active { transform: translateY(0); transition-duration: .06s; }

/* The whole card is the main target: the ::after covers it. */
.rx-card-main {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  text-align: left; color: var(--rx-ink); text-decoration: none;
  background: none; border: 0; padding: 0 44px 0 0; cursor: pointer; font: inherit;
  outline: none;
}
.rx-card-main::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
.rx-card:has(.rx-card-main:focus-visible) { outline: 3px solid var(--rx-focus); outline-offset: 3px; }

.rx-ic {
  display: flex; align-items: center; justify-content: center;
  width: 60px; height: 60px; border-radius: 17px; margin-bottom: 6px;
  background: linear-gradient(145deg, color-mix(in srgb, var(--rx-card-fill) 82%, #fff), var(--rx-card-fill));
  color: var(--rx-card-on-fill);
  box-shadow: 0 8px 16px -10px var(--rx-card-fill);
}
.rx-ic svg { width: 30px; height: 30px; }
.rx-name {
  font: 800 clamp(17px, 1.35vw, 20px)/1.2 var(--font-heading, system-ui), sans-serif;
  letter-spacing: -.01em; color: var(--rx-ink);
}
.rx-desc {
  font: 400 clamp(13px, 1vw, 15px)/1.4 var(--font-body, system-ui), sans-serif; color: var(--rx-ink-2);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.rx-chev {
  position: absolute; right: 18px; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 999px;
  background: var(--rx-card-chev-bg); color: var(--rx-card-chev);
  transition: transform .16s ease;
}
.rx-chev svg { width: 20px; height: 20px; }
.rx-card:hover .rx-chev { transform: translate(3px, -50%); }

/* The screens inside a module, one click from the launcher. Above the card's
   cover so each is a target of its own. */
.rx-card-links { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: auto; }
.rx-card-link {
  /* A fixed-height box that centres its text both ways. Line-height 1 with
     vertical padding left the words wherever the font's own ascent put them —
     visibly high or low depending on the typeface a company picked. */
  display: inline-flex; align-items: center; justify-content: center;
  height: 26px; padding: 0 10px; box-sizing: border-box;
  /* The app gives every link a 36px touch-target floor. These chips are shown
     only on wider screens, where that floor just makes a tall pill with the
     words floating in it. */
  min-height: 0;
  font: 600 12px/1 var(--font-ui, system-ui), sans-serif;
  white-space: nowrap;
  color: var(--rx-card-link); text-decoration: none;
  background: rgba(255, 255, 255, .8); border: 1px solid var(--rx-card-edge);
  border-radius: 999px;
}
.rx-card-link:hover { background: #fff; border-color: var(--rx-card-link); }
.rx-card-link:focus-visible { outline: 2px solid var(--rx-focus); outline-offset: 2px; }
.rx-card-more {
  display: inline-flex; align-items: center; height: 26px; padding: 0 2px;
  font: 500 12px/1 var(--font-ui, system-ui), sans-serif; color: var(--rx-ink-2);
}

/* The count of work waiting inside. Absolutely placed so it never moves the
   icon on the one card that has something waiting. */
.rx-badge { position: absolute; top: 14px; right: 14px; margin-left: 0; z-index: 1; box-shadow: 0 0 0 2px #fff; }

/* The slot key, on hover only. */
.rx-slot {
  position: absolute; top: 12px; right: 16px;
  font: 500 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--rx-ink-3);
  opacity: 0; transition: opacity .12s ease;
}
.rx-card:hover .rx-slot, .rx-card-main:focus-visible .rx-slot { opacity: 1; }
.rx-card:has(.rx-badge) .rx-slot { display: none; }

.rx-empty { padding: 42px 0; text-align: center; font-size: 14px; color: var(--rx-ink-2); }

/* ── Footer ──────────────────────────────────────────────────────────────── */
.rx-footer {
  display: flex; align-items: center; gap: 16px;
  max-width: none; margin-top: auto; padding-block: 16px;
  background: linear-gradient(120deg, var(--rx-hero-a), var(--rx-hero-b));
  color: var(--rx-on-hero);
}
.rx-brand-sm .rx-brand-logo, .rx-brand-sm .rx-brand-mark { height: 28px; width: 28px; font-size: 15px; border-radius: 8px; }
.rx-brand-sm .rx-brand-name { font-size: 18px; }
.rx-footer-tag {
  font: 500 13px/1.3 var(--font-ui, system-ui), sans-serif; opacity: .9;
  padding-left: 16px; border-left: 1px solid color-mix(in srgb, currentColor 40%, transparent);
}

/* ── Smaller screens ─────────────────────────────────────────────────────── */
@media (max-width: 859px) {
  .rx-keys { display: none; }
  .rx-banner { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); min-height: 150px; }
  .rx-banner-text { padding: 20px 0 46px 20px; }
}
@media (max-width: 519px) {
  .rx-hero { padding-bottom: 34px; }
  .rx-brand-logo, .rx-brand-mark { height: 34px; width: 34px; }
  .rx-avatar { width: 40px; height: 40px; font-size: 13px; }
  .rx-hero-btn { width: 36px; height: 36px; }
  .rx-search input { height: 54px; font-size: 16px; }
  .rx-content { padding-block: 16px 20px; gap: 16px; }
  .rx-cards { gap: 12px; }
  .rx-card { min-height: 164px; padding: 16px 14px 14px; border-radius: 18px; }
  .rx-card-main { padding-right: 34px; }
  .rx-ic { width: 50px; height: 50px; border-radius: 14px; }
  .rx-ic svg { width: 25px; height: 25px; }
  .rx-name { font-size: 16px; }
  .rx-desc { font-size: 13px; }
  .rx-chev { width: 32px; height: 32px; right: 12px; }
  .rx-chev svg { width: 17px; height: 17px; }
  /* The design on a phone is name and summary only; the shortcuts are for
     screens with room to spare. */
  .rx-card-links { display: none; }
  .rx-banner-badge { right: 10px; bottom: 10px; padding: 7px 11px; font-size: 11px; }
  .rx-footer-tag { font-size: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .rx-card, .rx-chev, .rx-slot, .rx-search::before { transition: none; }
  .rx-card:hover, .rx-card:active { transform: none; }
  .rx-card:hover .rx-chev { transform: translateY(-50%); }
}
`;
