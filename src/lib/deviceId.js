/**
 * This device's id, for the one-device-at-a-time sign-in rule.
 *
 * A random id made once and kept in this browser's storage (the mobile app's
 * WebView keeps its own). Sign-in calls carry it, so the server can tell this
 * device coming back — a closed tab, a restarted app, the passcode screen —
 * from a different device, and only refuse the latter. It identifies nothing
 * about the person; clearing site data simply makes this a new device.
 */
const KEY = 'rx-device-id';

const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

let memo = null;

export function getDeviceId() {
  if (memo) return memo;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) { memo = saved; return memo; }
    memo = makeId();
    localStorage.setItem(KEY, memo);
  } catch {
    // Storage blocked: an id for this page's life. The server then sees a new
    // device after a reload, which is the safe direction.
    memo = memo || makeId();
  }
  return memo;
}
