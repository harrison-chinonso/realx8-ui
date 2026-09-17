/**
 * Keeps a sleeping backend awake while somebody has this app open.
 *
 * ── The problem ──────────────────────────────────────────────────────────────
 *
 * Staging runs on a host that stops the service after ~15 minutes of quiet and
 * cold-starts it on the next request. A user who reads a page for a while and
 * then clicks something waits out that cold start, and what they see is a
 * request that hangs for tens of seconds — indistinguishable, from where they
 * sit, from the application being broken.
 *
 * So the page pings the API on an interval shorter than the idle timeout. The
 * host counts the ping as traffic and never stops the service.
 *
 * ── Why /health, and nothing else ────────────────────────────────────────────
 *
 * The ping must not reach the database. Realx8-Core answers /health from
 * server.js itself, BEFORE the auth gate and before the post-auth middleware,
 * and the handler only reports which services are running in-process. The
 * security layer lists it in ALWAYS_SKIP, so the tool filter and the signed
 * frontend header do not run for it either. Nothing on that path opens a
 * connection, reads a row or writes a session: it is the HTTP layer and the
 * event loop, which is exactly what the host is watching.
 *
 * That is also why this uses plain fetch rather than the axios client. The
 * client attaches the bearer token, signs the request, and carries the
 * refresh-on-401 interceptor — none of which a keep-alive should be able to
 * set off. A ping that could trigger a token refresh, or queue behind one, is
 * no longer a ping.
 *
 * ── Off unless a build turns it on ───────────────────────────────────────────
 *
 * VITE_KEEPALIVE is read at BUILD time, like every VITE_ value: it is baked
 * into the bundle by the build that sets it, so staging gets the pings and
 * production and local development do not. Nothing to switch at runtime, and
 * nothing to forget to switch off.
 *
 * ── What it does not do ──────────────────────────────────────────────────────
 *
 * It only keeps the service up while a tab is open. Nobody on the app for an
 * hour means the service sleeps and the next person still pays for the cold
 * start — an uptime pinger outside the browser is the fix for that case, and
 * this is not a substitute for one.
 */
import { apiUrl } from '../api/apiBase';

const truthy = (value) => ['on', 'true', '1', 'yes'].includes(String(value ?? '').toLowerCase());

const ENABLED = truthy(import.meta.env.VITE_KEEPALIVE);

/** Where to ping. Configurable only so a deployment can point at its own probe. */
const PATH = import.meta.env.VITE_KEEPALIVE_PATH || '/health';

/**
 * How often, in minutes.
 *
 * 13 by default, against a 15-minute idle timeout: comfortably inside it, and
 * with enough room that one failed ping does not lose the service.
 *
 * Floored at one minute. A typo — a stray `0.05`, an empty string that reads
 * as zero — would otherwise turn a keep-alive into a request loop against the
 * very service it is meant to protect.
 */
const configured = Number(import.meta.env.VITE_KEEPALIVE_MINUTES);
const MINUTES = Number.isFinite(configured) && configured > 0 ? Math.max(1, configured) : 13;
const INTERVAL_MS = MINUTES * 60 * 1000;

let timer = null;
let lastPingAt = 0;

const ping = () => {
  // Stamped before the request, not after: a ping that is in flight has
  // already done its job for this interval, and a slow one must not let the
  // visibility catch-up fire a second.
  lastPingAt = Date.now();

  /*
   * The timestamp is a cache-buster. Anything sitting in front of the API —
   * the browser's own cache, a CDN, a platform's edge — serving a stored 200
   * would keep this page believing it is pinging while no request reaches the
   * host, which is the one failure this would never show a symptom for.
   */
  return fetch(`${apiUrl(PATH)}?keepalive=${lastPingAt}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
  }).catch(() => {
    /*
     * Swallowed deliberately. The backend being unreachable is the state this
     * exists to prevent, not an error to report: the next tick tries again,
     * and a console full of keep-alive failures during a cold start would bury
     * whatever the user is actually looking at.
     */
  });
};

/**
 * Pings on returning to the tab, if the interval has lapsed.
 *
 * Browsers throttle — and eventually freeze — timers in a background tab, so a
 * tab left open behind others can easily miss its ticks and let the service
 * sleep. The moment it comes back is exactly when the user is about to click
 * something, so it is also the moment worth spending a request on.
 */
const onVisibilityChange = () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastPingAt >= INTERVAL_MS) ping();
};

/**
 * Starts pinging. Returns a teardown, and is safe to call more than once.
 */
export const startKeepAlive = () => {
  if (!ENABLED || typeof window === 'undefined') return () => {};
  if (timer) return stopKeepAlive;

  // Immediately, once: the tab may have been opened onto an already-sleeping
  // service, and waiting a full interval to warm it wastes the one moment the
  // user is reading the first screen.
  ping();
  timer = setInterval(ping, INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return stopKeepAlive;
};

export const stopKeepAlive = () => {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVisibilityChange);
};

/** For a dev console line or a diagnostics screen — not used to gate anything. */
export const keepAliveStatus = () => ({ enabled: ENABLED, path: PATH, minutes: MINUTES });

export default startKeepAlive;
