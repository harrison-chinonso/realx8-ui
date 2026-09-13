import { create } from 'zustand';
import { listReceipts } from '../api/financeApi';

/**
 * Counts of work waiting, for the badges on the sidebar.
 *
 * ── Why a store and not a hook in each layout ───────────────────────────────
 *
 * Seven components render nav items — five layout templates plus Sidebar and
 * CollapsibleSection — and the badge has to appear the same way in all of them.
 * A hook called per render site would issue the same request several times on
 * one page load, and the count could differ between two copies of the same menu
 * item on screen at once. One store, fetched once, read everywhere.
 *
 * ── Why the count comes from the list endpoint ──────────────────────────────
 *
 * `GET /receipts?status=pending` already exists, is already company-scoped by
 * the same rule the Payment Approvals page uses, and returns the total in its
 * pagination. A dedicated count endpoint would be a second place for that
 * scoping to be written, and a second place for it to drift from the page the
 * badge is pointing at — the one failure that would make the badge actively
 * misleading rather than merely absent. `limit: 1` keeps the payload to a
 * single row; it is the COUNT that is wanted.
 */

/** Never render a badge for a number nobody would act on. */
const MAX_DISPLAY = 99;

export const formatBadgeCount = (count) => (count > MAX_DISPLAY ? `${MAX_DISPLAY}+` : String(count));

const useNavBadgeStore = create((set, get) => ({
  /** keyed by the `badge` name a nav item declares. */
  counts: {},
  loading: false,

  /**
   * Refresh every badge count.
   *
   * Best effort throughout. A badge is an affordance, not information the page
   * depends on: if the request fails the count simply stays as it was, or stays
   * absent. Surfacing an error here would put a failure message on the sidebar
   * of every screen in the application.
   *
   * @param {boolean} enabled  whether this user can see the badged screen at
   *        all. Passed in rather than decided here so the rule lives with the
   *        nav item — see NavBadges. A client must not have their own receipts
   *        counted into a staff review queue.
   */
  refresh: async ({ enabled = true } = {}) => {
    if (!enabled) {
      // Clear rather than leave a stale count from a previous session — signing
      // out and back in as somebody else must not inherit the old badge.
      set({ counts: {} });
      return;
    }
    if (get().loading) return;

    set({ loading: true });
    try {
      const response = await listReceipts({ status: 'pending', limit: 1 });
      const total = Number(response?.pagination?.total);
      set((state) => ({
        counts: {
          ...state.counts,
          pendingApprovals: Number.isFinite(total) ? total : 0,
        },
      }));
    } catch {
      // Leave the previous count in place.
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Drop a count to zero immediately.
   *
   * For the moment an admin approves or rejects the last pending payment: the
   * badge should go as the row does, not on the next poll. The next refresh
   * corrects it if something else arrived meanwhile.
   */
  clear: (key) => set((state) => ({ counts: { ...state.counts, [key]: 0 } })),
}));

export default useNavBadgeStore;
