/**
 * Display helpers shared by the billing screens and the banner.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Account types that run the company's subscription. Matches the server's checkout guard. */
export const BILLING_ADMIN_TYPES = ['super_admin', 'admin'];

export const STATUS_LABELS = {
  trialing: 'Free trial',
  active: 'Active',
  grace: 'Payment due',
  lapsed: 'Read-only',
  none: 'No plan',
};

/** Badge colours, in the same palette WebsiteRequestsPage uses for its statuses. */
export const STATUS_STYLE = {
  trialing: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  grace: 'bg-amber-100 text-amber-800',
  lapsed: 'bg-red-100 text-red-700',
  none: 'bg-slate-100 text-slate-600',
};

export const INTERVAL_LABELS = { monthly: 'Monthly', annual: 'Annual' };

/**
 * Plan prices in the plan's own currency, not the company's.
 *
 * useCurrency() formats in whatever currency the company trades in, which is
 * right for property prices and wrong here: the subscription is priced in NGN
 * whatever a company sells in. Same Intl shape as AppearanceContext's
 * formatCurrency so the two read alike.
 */
export const formatPlanMoney = (amount, currency = 'NGN') => {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'NGN',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toLocaleString('en-US')}`;
  }
};

export const formatBillingDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
}) : '—');

/**
 * Whole days until a date, rounded UP — "ends in 1 day" on the last afternoon
 * rather than "ends in 0 days", which reads as already over. Never negative.
 */
export const daysUntil = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / DAY_MS));
};

/** Whether the company has used every seat its plan allows. Unlimited (null) never is. */
export const atUserLimit = (users) => Boolean(users && users.limit != null && Number(users.used) >= Number(users.limit));

/** "Unlimited users" / "Up to 100 users". */
export const userLimitLabel = (limit) => (limit == null ? 'Unlimited users' : `Up to ${Number(limit).toLocaleString()} users`);
