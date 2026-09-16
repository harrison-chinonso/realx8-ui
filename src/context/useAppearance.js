// Plain JS — only hooks, no JSX. Fast Refresh is never an issue here.
import { useContext, useEffect, useState } from 'react';
import { AppearanceContext } from './appearanceContextRef';
import { readableTextOn } from '../utils/colorUtils';

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
