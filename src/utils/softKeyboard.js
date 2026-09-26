/**
 * When the on-screen keyboard is allowed to appear, and how to send it away.
 *
 * ── The complaint ───────────────────────────────────────────────────────────
 *
 * On a phone the keyboard was opening by itself — arriving on a page, opening a
 * dropdown, opening the launcher, opening the assistant. Every one of those
 * focuses a search field on mount, which is a good idea with a hardware
 * keyboard and a bad one without: focus IS the keyboard on a touch device. It
 * slides up over half the screen, shoves the layout around, and nobody asked
 * for it. Because it depended on which control you happened to touch, it read
 * as the keyboard appearing at random.
 *
 * The rule this module encodes: on a touch device the keyboard opens when the
 * person taps a field, and at no other time. Nothing here changes desktop
 * behaviour, where autofocus costs nothing and saves a click.
 *
 * ── Why a media query rather than the user agent ────────────────────────────
 *
 * `pointer: coarse` asks the question that actually matters — is the primary
 * pointer a finger — and it answers correctly for tablets, for phones, and for
 * a touchscreen laptop where the person is using the trackpad. Sniffing the
 * user agent answers a different question and gets Android tablets wrong.
 */

/** True when the primary pointer is a finger, so focus would raise a keyboard. */
export function isTouchPrimary() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    // Very old browsers without the pointer media feature: assume a mouse,
    // which preserves the previous behaviour rather than degrading desktop.
    return false;
  }
}

/**
 * Focus `element` only where that will not summon a keyboard.
 *
 * Use for the convenience focus a control does on its own — a dropdown's search
 * box, a launcher's filter. Do NOT use it for focus the person asked for by
 * tapping a field; that is the browser's job and needs no help.
 */
export function focusUnlessTouch(element) {
  if (!element || isTouchPrimary()) return false;
  element.focus();
  return true;
}

/**
 * `autoFocus` for a JSX field, resolved for the current device.
 *
 * Spread it rather than hard-coding the attribute: <input {...autoFocusProps()} />
 */
export function autoFocusProps() {
  return isTouchPrimary() ? {} : { autoFocus: true };
}

/**
 * Put the keyboard away.
 *
 * The other half of the complaint: the keyboard stayed up after the field was
 * done with, covering the result of whatever had just been typed. A closing
 * dropdown, a submitted search or a dismissed modal leaves the input focused,
 * and a phone keeps the keyboard up for as long as something is focused — so
 * the blur has to be explicit.
 *
 * Only ever blurs a text-entry element, so it cannot steal focus from a button
 * or break keyboard navigation on a desktop.
 */
export function dismissKeyboard() {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (!active || typeof active.blur !== 'function') return;
  const tag = active.tagName;
  const typable = tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable;
  if (typable) active.blur();
}
