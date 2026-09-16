import { create } from 'zustand';
import { listReceipts, listPendingNotes } from '../api/financeApi';
import { listNotifications } from '../api/notificationApi';

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
      /**
       * Both counts in one pass, and neither is allowed to sink the other.
       *
       * A staff member holding one permission but not the other gets a 403 on
       * the endpoint they cannot see — which must not blank the badge they
       * can. allSettled rather than all, for exactly that.
       */
      const [receipts, notes] = await Promise.allSettled([
        listReceipts({ status: 'pending', limit: 1 }),
        listPendingNotes(),
      ]);

      set((state) => {
        const counts = { ...state.counts };

        if (receipts.status === 'fulfilled') {
          const total = Number(receipts.value?.pagination?.total);
          counts.pendingApprovals = Number.isFinite(total) ? total : 0;
        }
        if (notes.status === 'fulfilled') {
          const rows = notes.value?.data ?? notes.value ?? [];
          counts.pendingNotes = Array.isArray(rows) ? rows.length : 0;
        }

        return { counts };
      });
    } catch {
      // Leave the previous counts in place.
    } finally {
      set({ loading: false });
    }
  },

  /**
   * The bell's unread count.
   *
   * Separate from refresh() because the gate is different: that one is skipped
   * unless a badged NAV item is visible, which depends on finance permissions,
   * and the bell is shown to everyone who is signed in. Folding this into the
   * same call would blank the bell for every user who cannot see the payment
   * approvals queue.
   *
   * It lives in this store rather than in each layout because six layouts drew
   * that badge, each fetching the count once in its own mount effect, and
   * nothing told any of them when the notifications page marked everything
   * read - so the badge sat there until a full page reload. One count, one
   * fetch, and one place to clear it.
   */
  refreshNotifications: async ({ enabled = true } = {}) => {
    if (!enabled) {
      set((state) => ({ counts: { ...state.counts, unreadNotifications: 0 } }));
      return;
    }
    try {
      const response = await listNotifications();
      const rows = response?.data ?? response ?? [];
      const unread = Array.isArray(rows) ? rows.filter((row) => !row.is_read).length : 0;
      set((state) => ({ counts: { ...state.counts, unreadNotifications: unread } }));
    } catch {
      // Best effort, like every other count here.
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
