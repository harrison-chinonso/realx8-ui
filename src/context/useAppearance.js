// Plain JS — only hooks, no JSX. Fast Refresh is never an issue here.
import { useContext, useEffect, useState } from 'react';
import { AppearanceContext } from './appearanceContextRef';
import { readableTextOn, darkerOf, surfaceTokens } from '../utils/colorUtils';

export function useAppearance() {
  return useContext(AppearanceContext);
}

export function useCurrency() {
  return useContext(AppearanceContext).formatCurrency;
}

/**
 * Text color for elements filled with var(--primary).
 *
 * Reads the *computed* variable rather than the raw setting, so it follows the
 * dark-mode brightening applyTheme performs on the tenant's brand color.
 */
/**
 * Text colour for elements filled with var(--secondary).
 *
 * The secondary counterpart of useOnPrimary, for the few places that need the
 * value in JS rather than as a CSS variable.
 */
export function useOnSecondary() {
  const appearance = useContext(AppearanceContext);
  const [color, setColor] = useState('#ffffff');

  useEffect(() => {
    const secondary = getComputedStyle(document.documentElement).getPropertyValue('--secondary');
    setColor(readableTextOn(secondary));
  }, [appearance?.secondary_color, appearance?.dark_secondary_color, appearance?.dark_mode]);

  return color;
}

export function useOnPrimary() {
  const appearance = useContext(AppearanceContext);
  const [color, setColor] = useState('#ffffff');

  useEffect(() => {
    const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary');
    setColor(readableTextOn(primary));
  }, [appearance?.primary_color, appearance?.dark_primary_color, appearance?.dark_mode]);

  return color;
}

/**
 * The CSS variables for a card filled with the tenant's darker brand colour.
 *
 * ── Which colour ────────────────────────────────────────────────────────────
 *
 * The darker of primary and secondary, by luminance. Not "the secondary" —
 * nothing says a tenant puts the deeper colour in that slot, and the executive
 * card is a heavy dark panel by design: it is the one surface on the page that
 * holds the money figures, and its weight is what separates them from the
 * white cards around it. Choosing by luminance keeps that weight whichever way
 * round the two colours were entered.
 *
 * ── Read from the computed variables ────────────────────────────────────────
 *
 * Same as useOnPrimary above, and for the same reason: the computed value is
 * what the tenant's colour becomes after applyTheme's dark-mode brightening,
 * and the raw setting is not. Recomputed whenever any of the four colour
 * settings or the mode changes, so the Appearance screen's live preview
 * follows along.
 *
 * Spread onto the element as a style object; everything inside it then reads
 * var(--sf-…). See surfaceTokens for what each one is for.
 */
export function useBrandSurface() {
  const appearance = useContext(AppearanceContext);
  const [tokens, setTokens] = useState(() => surfaceTokens('#0f172a'));

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue('--primary').trim();
    const secondary = styles.getPropertyValue('--secondary').trim();
    setTokens(surfaceTokens(darkerOf(primary, secondary)));
  }, [
    appearance?.primary_color,
    appearance?.secondary_color,
    appearance?.dark_primary_color,
    appearance?.dark_secondary_color,
    appearance?.dark_mode,
  ]);

  return tokens;
}
