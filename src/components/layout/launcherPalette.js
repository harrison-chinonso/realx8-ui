import {
  contrastRatio, hexToHsl, hslToHex, mixHex, readableOn, readableTextOn,
} from '../../utils/colorUtils';

/**
 * The launcher's module colours — one per module card.
 *
 * ── Why a palette of its own ────────────────────────────────────────────────
 *
 * A company configures two brand colours, and the launcher shows eight modules
 * side by side. Two colours across eight cards either repeats (and the colour
 * stops saying which module you are looking at) or needs six more that nobody
 * chose. So the company picks them: `accent_colors` in the appearance settings,
 * up to eight hex values. Unset, the launcher uses the suggested palette below;
 * "From my brand" in Settings derives eight from the primary instead.
 *
 * ── What stays brand-coloured regardless ────────────────────────────────────
 *
 * The header, the welcome banner, the search focus and the footer all use the
 * primary and secondary. Only the module cards take the palette.
 */

/** The suggested palette: distinct hues that hold white glyphs at 3:1 or better. */
export const DEFAULT_ACCENTS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#7c3aed', // violet
  '#ea580c', // orange
  '#0891b2', // teal
  '#9333ea', // purple
  '#db2777', // pink
  '#1e40af', // navy
];

export const ACCENT_COUNT = DEFAULT_ACCENTS.length;

const HEX = /^#[0-9a-f]{6}$/i;

/** The stored comma-separated list, cleaned; the suggested palette fills any gap. */
export const parseAccents = (value) => {
  const given = String(value || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => HEX.test(part));
  return DEFAULT_ACCENTS.map((fallback, index) => given[index] || fallback);
};

export const serialiseAccents = (colours) => colours
  .map((colour) => String(colour || '').toLowerCase())
  .filter((colour) => HEX.test(colour))
  .slice(0, ACCENT_COUNT)
  .join(',');

/**
 * Eight colours from one brand colour.
 *
 * The primary first, then hues rotated around the wheel at the primary's own
 * saturation and a lightness that carries a white glyph — so the set reads as
 * one family rather than a rainbow bolted onto a brand. Saturation is floored,
 * because a near-grey primary would otherwise produce eight greys.
 */
export const brandAccents = (primary) => {
  if (!HEX.test(primary || '')) return [...DEFAULT_ACCENTS];
  const [h, s] = hexToHsl(primary);
  const sat = Math.max(55, Math.min(s, 85));
  const rotations = [130, 265, 30, 190, 295, 330, 220];
  return [
    primary.toLowerCase(),
    ...rotations.map((turn) => hslToHex((h + turn) % 360, sat, 44)),
  ];
};

/**
 * Which palette slot a module takes.
 *
 * By NAME for the known modules, so Finance is the same colour for everybody
 * whatever else their permissions put before it — a colour that moves when a
 * tile is added is a colour nobody can learn. Anything else takes a stable slot
 * from its name.
 */
const KNOWN_SLOTS = {
  Dashboard: 0,
  'People & Access': 1,
  Properties: 2,
  'Listed Properties': 2,
  'Sales & CRM': 3,
  Finance: 4,
  'My Commissions': 4,
  Investments: 5,
  'Marketing & Content': 6,
  'Operations & Support': 7,
  'Platform Admin': 7,
  'My Referrals': 1,
  'My Clients': 3,
};

export const accentSlotFor = (name = '') => {
  if (Object.prototype.hasOwnProperty.call(KNOWN_SLOTS, name)) return KNOWN_SLOTS[name];
  let hash = 0;
  for (const char of String(name)) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return hash % ACCENT_COUNT;
};

/**
 * Everything one card needs from its colour, all of it legible.
 *
 *   fill      the icon tile — the colour itself, nudged only if its glyph
 *             would not reach 3:1 (a large icon is a graphical object)
 *   onFill    the glyph on it, whichever of white or ink reads better
 *   tint      the card surface: the colour at 8% on white
 *   edge      the card's hairline
 *   chevBg    the circle behind the chevron
 *   chevInk   the chevron, held at 3:1 on its circle
 *   link      the colour AS TEXT on the tint, held at 4.5:1 — sub-menu links
 */
export const accentTokens = (accent) => {
  const base = HEX.test(accent || '') ? accent : DEFAULT_ACCENTS[0];
  // White where it clears 3:1 — the threshold for a graphic, which an icon is —
  // because that is the look of the design; otherwise whichever ink reads best.
  const glyph = contrastRatio('#ffffff', base) >= 3 ? '#ffffff' : readableTextOn(base);
  const fill = contrastRatio(glyph, base) >= 3 ? base : readableOn(base, glyph, 3);
  const tint = mixHex(base, '#ffffff', 0.92);
  const chevBg = mixHex(base, '#ffffff', 0.8);
  return {
    fill,
    onFill: contrastRatio('#ffffff', fill) >= 3 ? '#ffffff' : readableTextOn(fill),
    tint,
    edge: mixHex(base, '#ffffff', 0.78),
    chevBg,
    chevInk: readableOn(base, chevBg, 3),
    link: readableOn(base, tint, 4.5),
  };
};

/** The tokens as CSS custom properties, for a style prop. */
export const accentStyle = (accent) => {
  const t = accentTokens(accent);
  return {
    '--rx-card-fill': t.fill,
    '--rx-card-on-fill': t.onFill,
    '--rx-card-tint': t.tint,
    '--rx-card-edge': t.edge,
    '--rx-card-chev-bg': t.chevBg,
    '--rx-card-chev': t.chevInk,
    '--rx-card-link': t.link,
  };
};
