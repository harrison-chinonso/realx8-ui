import client from './client';

/**
 * Subscription billing (Realx8-Core billing routes).
 *
 * Everything here sits behind the server's BILLING_ENABLED flag. When it is
 * off, /billing/status answers `{ enabled: false }` and the rest of the UI
 * draws nothing — see store/billingStore.js, which is the one place that
 * decides whether billing exists for this session.
 */

// ── Any signed-in user ──────────────────────────────────────────────────────
export const getBillingStatus = () => client.get('/billing/status').then((r) => r.data?.data);
/** Returns the whole body: the plans plus `trial_days` and `enabled` beside them. */
export const listBillingPlans = () => client.get('/billing/plans').then((r) => r.data);

// ── Company administrators ──────────────────────────────────────────────────
/** Starts a Paystack payment; the caller sends the browser to `authorization_url`. */
export const startCheckout = ({ plan_code, interval }) =>
  client.post('/billing/checkout', { plan_code, interval }).then((r) => r.data?.data);
/** Called on the way back from Paystack, with the reference it put in the URL. */
export const confirmPayment = (reference) =>
  client.get(`/billing/confirm/${encodeURIComponent(reference)}`).then((r) => r.data?.data);
export const listBillingPayments = () => client.get('/billing/payments').then((r) => r.data?.data || []);
/** Sign-ups waiting for the subscription to be renewed or upgraded. */
export const listHeldAccounts = () => client.get('/billing/held').then((r) => r.data?.data || []);

// ── Platform administrators ─────────────────────────────────────────────────
export const adminListPlans = () => client.get('/billing/admin/plans').then((r) => r.data?.data || []);
export const adminUpdatePlan = (code, payload) =>
  client.put(`/billing/admin/plans/${encodeURIComponent(code)}`, payload).then((r) => r.data?.data);
/** Returns the whole body, because `enabled` sits beside the rows. */
export const adminListSubscriptions = (params) =>
  client.get('/billing/admin/subscriptions', { params }).then((r) => r.data);
export const adminMarkPaid = (companyId, payload) =>
  client.post(`/billing/admin/subscriptions/${companyId}/mark-paid`, payload).then((r) => r.data?.data);
export const adminExtendTrial = (companyId, days) =>
  client.post(`/billing/admin/subscriptions/${companyId}/extend-trial`, { days }).then((r) => r.data?.data);
export const adminChangePlan = (companyId, payload) =>
  client.post(`/billing/admin/subscriptions/${companyId}/change-plan`, payload).then((r) => r.data?.data);
