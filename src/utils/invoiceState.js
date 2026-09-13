/**
 * How an invoice's derived state reads to a buyer.
 *
 * The state itself is computed server-side on payment-analysis — `due`,
 * `in_progress`, `pending`, `paid` — because it depends on the balance and the
 * due date together, and two clients deriving it separately would eventually
 * disagree.
 *
 * The labels are spelled out rather than `capitalize`d from the key: the key is
 * `in_progress`, which renders as "In_progress", and the state is the one thing
 * on a row a buyer actually scans for.
 *
 * Shared because the picker and the payments table show the same states, and a
 * copy in each is how one of them ends up still calling a part-paid invoice
 * "pending" after the other stopped.
 */
export const STATE_TONE = {
  due: 'bg-rose-100 text-rose-700',
  in_progress: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  unbilled: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

export const STATE_LABEL = {
  due: 'Overdue',
  in_progress: 'Payment in progress',
  pending: 'Pending',
  paid: 'Paid',
  // Only a purchase can be in these two: it has no invoice behind it yet, or
  // the sale was called off.
  unbilled: 'Not invoiced',
  cancelled: 'Cancelled',
};

/**
 * Most pressing first: overdue, then part-paid, then untouched.
 *
 * A rank rather than a comparison between two states — with more than two of
 * them, "is this one due?" no longer orders the list.
 */
const RANK = { due: 0, in_progress: 1, pending: 2, paid: 3 };

export const stateRank = (state) => (RANK[state] ?? 99);
