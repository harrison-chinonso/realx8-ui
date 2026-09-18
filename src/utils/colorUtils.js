/**
 * Color math utilities for intelligent dark mode adaptation.
 */

export function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Brightens a hex color for use on dark backgrounds.
 *
 * Strategy:
 *  - Very dark colors (L < 25%) → push to L 62–65% (large jump needed)
 *  - Medium colors (L 25–50%)  → push to L 60%
 *  - Already-light colors      → gentle +15% boost, cap at 78%
 *  - Saturation floored at 55% so the result is vibrant, not washed-out
 */
export function brightenForDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#60a5fa';
  try {
    const [h, s, l] = hexToHsl(hex);
    let targetL;
    if (l < 25)      targetL = 63;
    else if (l < 50) targetL = 60;
    else             targetL = Math.min(l + 15, 78);
    const targetS = Math.min(100, Math.max(s, 55));
    return hslToHex(h, targetS, targetL);
  } catch {
    return '#60a5fa';
  }
}

/** Returns true if a hex color is "dark" (lightness < 45%) */
export function isDarkColor(hex) {
  if (!hex || !hex.startsWith('#')) return true;
  try {
    const [, , l] = hexToHsl(hex);
    return l < 45;
  } catch {
    return true;
  }
}

/** Parses #rgb / #rrggbb / rgb(...) into [r,g,b]; null when unrecognised. */
function toRgb(color) {
  const value = String(color || '').trim();
  if (!value) return null;

  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return null;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  }

  const parts = value.match(/-?\d+(\.\d+)?/g);
  return parts && parts.length >= 3 ? parts.slice(0, 3).map(Number) : null;
}

function relativeLuminance([r, g, b]) {
  const [rl, gl, bl] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** WCAG contrast ratio between two colors, 1 (identical) to 21 (black on white). */
export function contrastRatio(a, b) {
  const [ca, cb] = [toRgb(a), toRgb(b)];
  if (!ca || !cb) return 1;
  const [la, lb] = [relativeLuminance(ca), relativeLuminance(cb)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The more legible of white / near-black on `background`.
 *
 * Tenants choose their own brand color and several are pale — white on
 * #d6c7cb is 1.63:1, effectively invisible. Anything filled with the brand
 * color should take its text color from here instead of hard-coding white.
 *
 * Uses WCAG relative luminance, not the HSL lightness that isDarkColor()
 * relies on: lightness misjudges saturated hues (pure blue sits at L 50%).
 */
export function readableTextOn(background) {
  const WHITE = '#ffffff';
  const INK = '#111827';
  return contrastRatio(WHITE, background) >= contrastRatio(INK, background) ? WHITE : INK;
}

/**
 * `color`, darkened or lightened just far enough to be legible ON `background`.
 *
 * The counterpart to readableTextOn. That one answers "what text goes on this
 * brand fill"; this one answers "can the brand colour BE the text" — which is
 * the question every time a tenant colour is used for a label, a border or an
 * outline button rather than as a fill behind something else.
 *
 * The answer for a pale brand colour is no, and the useful response is not to
 * discard it but to walk its lightness toward the far side of the background
 * until it passes. Hue and saturation are kept, so it still reads as the
 * tenant's colour — a washed-out mint becomes a deeper mint, not grey.
 *
 * 4.5:1 is the WCAG AA floor for body text, and applying it here rather than at
 * each call site is what makes "any colour is safe" true rather than true for
 * the dark half of the range.
 */
export function readableOn(color, background = '#ffffff', min = 4.5) {
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) return color;
  if (contrastRatio(color, background) >= min) return color;

  const [h, s, l] = hexToHsl(color);
  // Toward whichever end of the scale the background is NOT.
  const towardLight = isDarkColor(background);

  for (let step = 2; step <= 100; step += 2) {
    const candidate = hslToHex(h, s, towardLight ? Math.min(l + step, 100) : Math.max(l - step, 0));
    if (contrastRatio(candidate, background) >= min) return candidate;
  }
  // A fully saturated hue at either extreme can still fall short; at that point
  // legibility wins over brand.
  return towardLight ? '#ffffff' : '#111827';
}

/** Blend two hex colours. `t` is how much of `b` to take: 0 → a, 1 → b. */
function mixHex(a, b, t) {
  const [ca, cb] = [toRgb(a), toRgb(b)];
  if (!ca || !cb) return a;
  const channel = (i) => Math.round(ca[i] + (cb[i] - ca[i]) * t);
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The darker of two colours, by relative luminance.
 *
 * Luminance rather than HSL lightness, for the reason readableTextOn gives:
 * lightness misjudges saturated hues, and "which of these two is darker" is
 * exactly the question it gets wrong on a saturated blue against a mid grey.
 */
export function darkerOf(a, b) {
  const [ca, cb] = [toRgb(a), toRgb(b)];
  if (!ca) return b;
  if (!cb) return a;
  return relativeLuminance(ca) <= relativeLuminance(cb) ? a : b;
}

/**
 * Everything a filled surface needs, derived from the one colour filling it.
 *
 * ── The problem it solves ────────────────────────────────────────────────────
 *
 * A card filled with a brand colour is not one decision, it is fifteen: the
 * heading, the muted labels, the hairline between sections, the track behind a
 * progress bar, the border on an outline button, and the semantic greens and
 * ambers that have to stay green and amber while remaining visible. Written by
 * hand against one background — slate-900, say — every one of them is a guess
 * that happens to be right for that background and silently wrong for any
 * other. The executive card had fourteen such guesses.
 *
 * Deriving them means the card can be filled with anything, including a colour
 * nobody has seen, and still be readable.
 *
 * ── Why solid blends rather than alpha ───────────────────────────────────────
 *
 * Each ink is mixed INTO the fill rather than laid over it at an opacity. The
 * result is identical where the surface is opaque, and it stays correct when
 * something is layered, printed, or screenshotted — and it can be measured,
 * which an alpha cannot without compositing it first.
 *
 * ── The semantic pair ────────────────────────────────────────────────────────
 *
 * Collected-green and outstanding-amber carry meaning, so they keep their hue
 * and move only in lightness, via readableOn. 3:1 rather than 4.5:1 because
 * they are a bar and a swatch — graphical objects, which is the threshold WCAG
 * sets for those. The numbers beside them are drawn in the ink, not in the
 * semantic colour.
 */
export function surfaceTokens(fill) {
  const requested = /^#[0-9a-f]{6}$/i.test(fill || '') ? fill : '#0f172a';

  /*
   * The fill itself gives way if it cannot carry text at all.
   *
   * A mid grey is the case: #808080 takes near-black at 4.49:1 and white at
   * 4.67 — neither clears AA by the time the fill is that close to the middle
   * of the range. No choice of foreground fixes it, so the background moves,
   * 4% at a time, away from the ink it has chosen. Most colours pass straight
   * through untouched; this is the escape hatch for the ones that cannot.
   */
  let base = requested;
  for (let i = 0; i < 12 && contrastRatio(readableTextOn(base), base) < 4.5; i += 1) {
    base = mixHex(base, readableTextOn(base) === '#ffffff' ? '#000000' : '#ffffff', 0.04);
  }

  const ink = readableTextOn(base);

  /**
   * A muted tier: `from` stepped back toward the fill, but no further than the
   * floor allows.
   *
   * Written as a retreat rather than as readableOn, deliberately. readableOn
   * decides which way to walk from isDarkColor(), which reads HSL lightness —
   * and that disagrees with readableTextOn's luminance on saturated mid-tones.
   * On #7C3AED the ink is white while HSL calls the background light, so
   * readableOn walked its candidate DARKER, toward the background, and gave up
   * at 3.11:1. Backing off a known-good colour cannot pick a wrong direction:
   * at zero it is the full ink, which is the best contrast available.
   */
  const stepBack = (from, amount, min) => {
    let t = amount;
    let out = mixHex(from, base, t);
    while (t > 0 && contrastRatio(out, base) < min) {
      t = Math.max(0, t - 0.04);
      out = mixHex(from, base, t);
    }
    return out;
  };

  /**
   * Meaning, kept legible: the hue survives, the lightness moves.
   *
   * Both directions are tried at each step and the nearer one wins, rather
   * than a direction being decided up front. readableOn decides up front from
   * isDarkColor(), and on #00B3A4 — HSL lightness 35%, so "dark" — it walked
   * emerald LIGHTER, toward a background whose luminance is nothing like dark,
   * and stalled at 2.63:1. There is no heuristic here to be wrong.
   *
   * 3:1 rather than 4.5 because these are a bar and two swatches: graphical
   * objects, which is the threshold WCAG sets for them. The figures beside
   * them are drawn in the ink.
   */
  const legibleHue = (color, min) => {
    if (contrastRatio(color, base) >= min) return color;
    const [h, sat, l] = hexToHsl(color);
    for (let step = 2; step <= 100; step += 2) {
      const darker = hslToHex(h, sat, Math.max(l - step, 0));
      if (contrastRatio(darker, base) >= min) return darker;
      const lighter = hslToHex(h, sat, Math.min(l + step, 100));
      if (contrastRatio(lighter, base) >= min) return lighter;
    }
    // A fully saturated hue against a background of similar luminance can run
    // out of lightness before it runs out of contrast. Meaning loses to being
    // seen at all.
    return ink;
  };

  const positive = legibleHue('#34d399', 3);
  const warning = legibleHue('#fcd34d', 3);

  return {
    '--sf-fill': base,
    '--sf-ink': ink,
    /*
     * The two label tiers the card already had — bounded, not merely mixed.
     *
     * A flat 28% / 48% is right on a deep fill and illegible on a saturated
     * mid-tone, where the full ink is only 4.9:1 to begin with. Where the floor
     * bites, the hierarchy in COLOUR flattens, and that is the correct outcome:
     * a background that can barely carry text cannot also carry three tiers of
     * it, and the card already separates them by size and weight.
     */
    '--sf-ink-muted': stepBack(ink, 0.28, 4.5),
    '--sf-ink-subtle': stepBack(ink, 0.48, 4.5),
    // Surfaces and lines, as fractions of the ink: a track to draw a bar on, a
    // rule between sections, a border an outline button can be seen by. Not
    // text, so no floor — a hairline that shouts is worse than one that
    // whispers.
    '--sf-track': mixHex(ink, base, 0.84),
    '--sf-line': mixHex(ink, base, 0.78),
    '--sf-border': mixHex(ink, base, 0.66),
    '--sf-border-strong': mixHex(ink, base, 0.46),
    '--sf-positive': positive,
    '--sf-warning': warning,
    // The bar's outstanding segment: stepped back so the collected segment
    // beside it stays dominant, and no further than 3:1 — it is a segment of a
    // bar carrying meaning, which is the threshold WCAG sets for one.
    '--sf-warning-soft': stepBack(warning, 0.45, 3),
  };
}
