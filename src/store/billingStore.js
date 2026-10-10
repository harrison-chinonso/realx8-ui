import { create } from 'zustand';
import { getBillingStatus } from '../api/billingApi';

/** How stale the status may get before regaining focus reads it again. */
const STALE_MS = 5 * 60 * 1000;

/**
 * The company's subscription status, read once per session.
 *
 * ── Why a store and not a hook's own state ─────────────────────────────────
 *
 * The nav (in every layout template), the banner and the billing page all ask
 * the same question. Held here, it is one request per session rather than one
 * per component, and they cannot disagree about whether billing is on.
 *
 * ── Why it is not persisted ─────────────────────────────────────────────────
 *
 * A status that survived a reload could say "active" for a company that lapsed
 * overnight. A reload is the moment to ask again.
 *
 * `key` is the account the status belongs to. Switching company is a new
 * account, so a status read for the previous one is thrown away rather than
 * shown against the wrong company until the next fetch lands.
 */
const useBillingStore = create((set, get) => ({
  status: null,
  key: null,
  fetchedAt: 0,
  inflight: null,

  load: async (key, { force = false } = {}) => {
    if (!key) {
      set({ status: null, key: null, fetchedAt: 0, inflight: null });
      return null;
    }
    const state = get();
    if (state.key !== key) set({ status: null, key, fetchedAt: 0, inflight: null });
    else if (state.inflight) return state.inflight;
    else if (!force && state.fetchedAt) return state.status;

    const request = getBillingStatus()
      .then((status) => {
        // A different account signed in while this was in flight.
        if (get().key === key) set({ status: status || { enabled: false }, fetchedAt: Date.now(), inflight: null });
        return status;
      })
      .catch(() => {
        /*
         * Treated as "off" rather than retried: an older server without the
         * route, or a failure, should leave the app exactly as it was before
         * billing existed — not show a banner built on a guess. fetchedAt is
         * still set, so focus does not hammer a route that is not there.
         */
        if (get().key === key) set({ status: { enabled: false }, fetchedAt: Date.now(), inflight: null });
        return null;
      });
    set({ inflight: request });
    return request;
  },

  /** Re-read on window focus, at most once per STALE_MS. */
  refreshIfStale: () => {
    const { key, fetchedAt, inflight } = get();
    if (!key || inflight || Date.now() - fetchedAt < STALE_MS) return;
    get().load(key, { force: true });
  },

  /** Replaces the status with one a payment or admin action just returned. */
  setStatus: (status) => {
    if (status) set({ status, fetchedAt: Date.now() });
  },
}));

/**
 * Whether billing exists at all for this session — the one test every piece of
 * billing UI makes before drawing anything. Selector-only: it never fetches,
 * so the layouts can read it without each starting a request.
 */
export const useBillingEnabled = () => useBillingStore((state) => state.status?.enabled === true);

export default useBillingStore;
