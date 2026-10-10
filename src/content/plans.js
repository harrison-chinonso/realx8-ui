/**
 * The subscription plans and the free trial.
 *
 * PLANS is the built-in copy of what Realx8-Core serves at GET /public/plans.
 * The site renders from it straight away, so prices show even when the API is
 * slow or down, and swaps in the served plans when they arrive (usePlans.js) —
 * a price changed in the app shows here without a redeploy. Keep this copy in
 * step with the app so the swap is invisible.
 *
 * Pure data and helpers, no React, so the assistant and its tests can use it.
 */

export const TRIAL_DAYS = 7;
/** Days after a trial or paid period ends before the company becomes read-only. */
export const GRACE_DAYS = 3;

export const PLANS = [
  {
    code: 'starter', name: 'Starter', description: 'For small and growing real estate companies',
    monthly_price: 50000, annual_price: 500000, currency: 'NGN', user_limit: 100, sort_order: 1, active: true,
  },
  {
    code: 'professional', name: 'Professional', description: 'For expanding real estate businesses',
    monthly_price: 75000, annual_price: 750000, currency: 'NGN', user_limit: 250, sort_order: 2, active: true,
  },
  {
    code: 'enterprise', name: 'Enterprise', description: 'For large developers and real estate organizations',
    monthly_price: 100000, annual_price: 1000000, currency: 'NGN', user_limit: null, sort_order: 3, active: true,
  },
];

/** ₦50,000 — grouped by hand rather than toLocaleString, so it reads the same in every browser and in Node. */
export const formatNaira = (amount) => `₦${String(Math.round(Number(amount) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/** What a year costs on the monthly price, less the annual price. Never negative. */
export const annualSaving = (plan) => Math.max(0, plan.monthly_price * 12 - plan.annual_price);

/** The annual saving as a percentage of a year of monthly payments, to two decimals (16.67). */
export const annualSavingPercent = (plan) => {
  const year = plan.monthly_price * 12;
  return year > 0 ? Math.round((annualSaving(plan) / year) * 10000) / 100 : 0;
};

export const formatPercent = (value) => `${Number(value.toFixed(2))}%`;

/** null means no limit — the API's way of saying unlimited. */
export const userLimitLabel = (plan) => (plan.user_limit == null
  ? 'Unlimited users'
  : `Up to ${String(plan.user_limit).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} users`);

/** How a chosen plan travels with a request — the team reads it among the interests. */
export const planInterest = (plan) => `Interested in the ${plan.name} plan`;

export const findPlan = (plans, code) => plans.find((p) => p.code === String(code || '').toLowerCase()) || null;

/** Postgres numeric columns often arrive as strings ("50000.00"), so take either. */
const toPrice = (v) => {
  const n = typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * The body of GET /public/plans as { plans, trialDays }, or null when it is not
 * something we can show. A single odd plan is dropped rather than shown wrong;
 * a response with no usable plans keeps the built-in ones on screen. Only NGN,
 * because every price on the site is written in naira.
 */
export const normalisePlans = (body) => {
  if (!body || !Array.isArray(body.data)) return null;
  const plans = body.data
    .filter((p) => p && p.active !== false
      && typeof p.code === 'string' && p.code.trim()
      && typeof p.name === 'string' && p.name.trim()
      && toPrice(p.monthly_price) && toPrice(p.annual_price)
      && (p.currency == null || p.currency === 'NGN')
      && (p.user_limit == null || (Number.isInteger(p.user_limit) && p.user_limit > 0)))
    .map((p) => ({
      code: p.code.trim().toLowerCase(),
      name: p.name.trim(),
      description: typeof p.description === 'string' ? p.description.trim() : '',
      monthly_price: toPrice(p.monthly_price),
      annual_price: toPrice(p.annual_price),
      currency: 'NGN',
      user_limit: p.user_limit ?? null,
      sort_order: Number.isFinite(p.sort_order) ? p.sort_order : 0,
      active: true,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
  if (!plans.length) return null;
  const trialDays = Number.isInteger(body.trial_days) && body.trial_days > 0 ? body.trial_days : TRIAL_DAYS;
  return { plans, trialDays };
};
