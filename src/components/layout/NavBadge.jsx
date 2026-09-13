import { useEffect } from 'react';
import useNavBadgeStore, { formatBadgeCount } from '../../store/navBadgeStore';
import useAuthStore from '../../store/authStore';
import { NAV, isNavItemVisible } from './navConfig';

/**
 * The count of outstanding work on a nav item, or nothing at all.
 *
 * Zero renders NOTHING — not a grey nought, not an empty pill. A badge is a
 * call to action, and one showing "0" is a permanent piece of furniture that
 * people stop seeing; the whole value of the badge is that its appearance means
 * something happened. It is also why the element is absent rather than hidden
 * with CSS: a screen reader should not announce a queue that is empty.
 */
/** Every badge-carrying entry beneath a nav item or list, at any depth. */
const leavesOf = (input) => {
  const list = Array.isArray(input) ? input : [input];
  return list.flatMap((entry) => {
    if (!entry) return [];
    return entry.children?.length ? leavesOf(entry.children) : [entry];
  });
};

/**
 * @param {object} [item]   a nav item; a sub-menu counts everything inside it.
 * @param {object[]} [items] a whole section, for a layout whose section header
 *        is a dropdown trigger — the badge has to appear on the closed trigger
 *        or it is inside the thing it is trying to make you open.
 */
export default function NavBadge({ item, items, className = '' }) {
  const counts = useNavBadgeStore((state) => state.counts);

  /**
   * A collapsed parent carries the sum of what is inside it.
   *
   * Payment Approvals lives under a "Payments" group that is closed unless
   * something in it is active — so without this the badge exists but is behind
   * a fold, which is precisely where a notification is no use.
   */
  const entries = leavesOf(items ?? item);
  const count = entries.reduce(
    (total, entry) => total + (entry.badge ? Number(counts[entry.badge]) || 0 : 0),
    0,
  );

  if (count < 1) return null;

  const described = entries.find((entry) => entry.badge && counts[entry.badge]);
  const label = `${count} ${described?.badgeLabel || 'awaiting attention'}`;

  return (
    <span
      className={`ml-auto inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full
        bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${className}`}
      // The number alone reads as "5" out of context; this says what five of.
      aria-label={label}
      title={label}
    >
      {formatBadgeCount(count)}
    </span>
  );
}

/** How often the counts are re-read while a tab is open. */
const POLL_MS = 60_000;

/**
 * Keeps the badge counts current. Rendered once, by AppLayout.
 *
 * ── Why it decides for itself whether to fetch ──────────────────────────────
 *
 * The rule is taken from navConfig rather than hardcoded here: if the badged
 * nav item is not visible to this user, the request is not made. That matters
 * for more than tidiness — `/receipts` is scoped per caller, so a CLIENT asking
 * for pending receipts gets their OWN, and a buyer with one payment awaiting
 * approval would otherwise see a "1" on a staff review queue they cannot open.
 * Deriving the condition from the same predicate that decides whether to draw
 * the menu item means the two cannot disagree.
 *
 * ── Why it polls, and why not faster ────────────────────────────────────────
 *
 * Payments arrive while an admin is on another screen, and the point of the
 * badge is to be noticed without going to look. A minute is frequent enough to
 * feel live and slow enough to be unnoticeable — one cheap COUNT. It also
 * refreshes when the tab regains focus, which covers the common case of coming
 * back to a window left open over lunch far better than any interval would.
 */
export function NavBadges() {
  const refresh = useNavBadgeStore((state) => state.refresh);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const userType = useAuthStore((state) => state.effectiveType());
  const token = useAuthStore((state) => state.accessToken);

  // Whether ANY badged item is visible to this user.
  const enabled = Boolean(token) && NAV
    .flatMap((section) => section.items)
    .flatMap((entry) => (entry.children ? entry.children : [entry]))
    .filter((entry) => entry.badge)
    .some((entry) => isNavItemVisible(entry, { hasPermission, isSuperiorAdmin, userType }));

  useEffect(() => {
    refresh({ enabled });
    if (!enabled) return undefined;

    const timer = setInterval(() => refresh({ enabled }), POLL_MS);
    const onFocus = () => refresh({ enabled });
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, refresh]);

  return null;
}
