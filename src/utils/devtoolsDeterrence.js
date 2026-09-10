/**
 * Makes casual inspection inconvenient. Nothing more than that.
 *
 * ── BE CLEAR ABOUT WHAT THIS IS ──────────────────────────────────────────────
 *
 * Devtools CANNOT be disabled from a web page. There is no API for it, and
 * there will not be one — the browser belongs to the user, not to this
 * application. Everything below is deterrence against someone poking around
 * casually, and every bit of it is bypassed by anyone who means it:
 *
 *   the menu shortcuts still open devtools (F12 is not the only route)
 *   `view-source:` and the browser menu are untouched
 *   the page source, the bundle and every API response remain readable
 *   disabling JavaScript disables all of this at once
 *
 * So it must never be the reason something is safe. Anything that must not
 * reach a user must not be SENT to them — that is a server-side authorisation
 * decision, and it is the permission checks that make it, not this file.
 *
 * What this does buy: a user who right-clicks out of habit, or an employee
 * idly opening the console on a shared screen, sees a closed door. That is a
 * real if modest thing, and it is the whole claim.
 */

/**
 * Off in development, always.
 *
 * A build of this application is also what its developers work in. Blocking
 * their console would be a self-inflicted wound, and worse, they would disable
 * it locally and forget it exists in production.
 */
const isProduction = import.meta.env.PROD;
const ENABLED = isProduction
  && String(import.meta.env.VITE_DEVTOOLS_DETERRENCE ?? 'on').toLowerCase() !== 'off';

/**
 * Shortcuts to swallow.
 *
 * Ctrl+U (view source) and Ctrl+S (save page) are here because they are the
 * other two habitual routes to the same place.
 */
const isBlockedCombination = (event) => {
  const key = String(event.key || '').toLowerCase();
  if (key === 'f12') return true;

  // Windows and Linux
  if (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) return true;
  if (event.ctrlKey && !event.shiftKey && ['u', 's'].includes(key)) return true;

  // macOS: devtools is Cmd+Opt+I/J/C, view source is Cmd+Opt+U
  if (event.metaKey && event.altKey && ['i', 'j', 'c', 'u'].includes(key)) return true;
  if (event.metaKey && !event.altKey && key === 's') return true;

  return false;
};

/**
 * A rough guess at whether devtools is open.
 *
 * It compares the window's outer and inner size: a docked devtools panel eats
 * the difference. It is a HEURISTIC and it is wrong in both directions — an
 * undocked window is invisible to it, and a zoomed page or an unusual
 * browser chrome can trigger it with devtools closed. It therefore only
 * reports; it must never be wired to log anyone out or destroy anything, or a
 * false positive becomes a user losing their work.
 */
const looksOpen = () => {
  const threshold = 160;
  return (window.outerWidth - window.innerWidth > threshold)
    || (window.outerHeight - window.innerHeight > threshold);
};

let cleanups = [];

/**
 * Installs the deterrence. Returns a function that removes it again.
 *
 * @param {object}   options
 * @param {Function} options.onDetected  Called (at most once per transition)
 *                                       when devtools appears to open. Report
 *                                       only — see the note on looksOpen.
 */
export const installDevtoolsDeterrence = ({ onDetected } = {}) => {
  if (!ENABLED) return () => {};

  const onContextMenu = (event) => { event.preventDefault(); };
  const onKeyDown = (event) => {
    if (isBlockedCombination(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  /**
   * Drag-and-copy of page content is left ALONE.
   *
   * Blocking selection and copy is the usual companion to this, and it is a
   * mistake: staff copy invoice numbers, client references and addresses out of
   * this application all day. Breaking that to inconvenience a determined
   * person who can read the DOM anyway trades real daily friction for no
   * security.
   */
  window.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown, true);
  cleanups.push(() => window.removeEventListener('contextmenu', onContextMenu));
  cleanups.push(() => window.removeEventListener('keydown', onKeyDown, true));

  if (onDetected) {
    let reported = false;
    const timer = setInterval(() => {
      const open = looksOpen();
      if (open && !reported) { reported = true; onDetected(); }
      if (!open) reported = false;
    }, 2000);
    cleanups.push(() => clearInterval(timer));
  }

  const teardown = () => { cleanups.forEach((fn) => fn()); cleanups = []; };
  return teardown;
};

export const isDeterrenceEnabled = () => ENABLED;
export default installDevtoolsDeterrence;
