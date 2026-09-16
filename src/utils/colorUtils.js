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
