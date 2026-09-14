import client from './client';

/**
 * Commission plans: the configuration that decides what a sale pays.
 *
 * A plan is a composition of rules a company admin edits — the whole point of
 * the engine being data rather than code. Distinct from `/commissions`, which
 * is an individual amount owed to one person.
 */

export const listCommissionPlans = (params) =>
  client.get('/commission-plans', { params }).then((r) => r.data?.data ?? []);

export const getCommissionPlan = (id) =>
  client.get(`/commission-plans/${id}`).then((r) => r.data?.data);

/** Creates the plan and its first version, both as drafts. */
export const createCommissionPlan = (payload) =>
  client.post('/commission-plans', payload).then((r) => r.data);

/**
 * A new DRAFT version of an existing plan.
 *
 * The only way to change a plan that has ever been live: an active version is
 * immutable, because a deal resolves the version in force at its attribution
 * date and editing one would restate what old deals paid.
 */
export const createPlanVersion = (id, payload) =>
  client.post(`/commission-plans/${id}/versions`, payload).then((r) => r.data);

/** Makes a draft version live. Refused if the validator rejects it. */
export const activatePlanVersion = (versionId, payload) =>
  client.post(`/commission-plan-versions/${versionId}/activate`, payload).then((r) => r.data);

export const archiveCommissionPlan = (id) =>
  client.delete(`/commission-plans/${id}`).then((r) => r.data);

/** The dry-run validator, on a configuration that has not been saved. */
export const validateCommissionPlan = (config, guardrail) =>
  client.post('/commission-plans/validate', { config, guardrail_percentage: guardrail })
    .then((r) => r.data?.data);

/**
 * What a structure would pay on a deal of a given size.
 *
 * Runs the real engine server-side and writes nothing, so the preview cannot
 * drift from what the plan will actually do.
 */
export const simulateCommissionPlan = (payload) =>
  client.post('/commission-plans/simulate', payload).then((r) => r.data);

/**
 * ── Reporting and payouts ───────────────────────────────────────────────────
 *
 * Every report is scoped to the caller's own company by the server, not by
 * anything sent from here. A `company_id` in these params is honoured only for
 * a platform admin, who has no company of their own; for everybody else it is
 * ignored, which is the only arrangement where the browser cannot widen its own
 * scope.
 */

export const commissionSummary = (params) =>
  client.get('/commission-reports/summary', { params }).then((r) => r.data?.data);

export const commissionBreakage = (params) =>
  client.get('/commission-reports/breakage', { params }).then((r) => r.data?.data);

export const commissionCostOfSale = (params) =>
  client.get('/commission-reports/cost-of-sale', { params }).then((r) => r.data?.data);

export const commissionLeaderboard = (params) =>
  client.get('/commission-reports/leaderboard', { params }).then((r) => r.data?.data ?? []);

export const commissionLiability = (params) =>
  client.get('/commission-reports/liability', { params }).then((r) => r.data?.data);

export const commissionGlExport = (params) =>
  client.get('/commission-reports/gl-export', { params }).then((r) => r.data?.data);

/**
 * What a candidate plan WOULD have cost over deals already closed.
 *
 * A POST because the plan is a document, not because anything is written — the
 * backtest writes nothing at all.
 */
export const backtestCommissionPlan = (plan, params) =>
  client.post('/commission-reports/backtest', { plan, ...params }).then((r) => r.data?.data);

export const listCommissionPayouts = (params) =>
  client.get('/commission-payouts', { params }).then((r) => r.data?.data ?? []);

/** Builds DRAFT payouts. Nothing is transferred until one is approved and paid. */
export const buildCommissionPayouts = (payload) =>
  client.post('/commission-payouts/build', payload).then((r) => r.data?.data);

export const approveCommissionPayout = (id) =>
  client.post(`/commission-payouts/${id}/approve`).then((r) => r.data);

export const payCommissionPayout = (id, reference) =>
  client.post(`/commission-payouts/${id}/pay`, { reference }).then((r) => r.data);

/** The signed-in realtor's own statement. The id comes from the session. */
export const myCommissionStatement = (params) =>
  client.get('/commission-statements/mine', { params }).then((r) => r.data?.data);

export const commissionStatementFor = (realtorId, params) =>
  client.get(`/commission-statements/${realtorId}`, { params }).then((r) => r.data?.data);

/**
 * Screening flags — patterns the engine noticed and a human should judge.
 *
 * Nothing here blocked anything. A flag is a reason to look, and the verdict is
 * what closes it.
 */
export const listCommissionFlags = (params) =>
  client.get('/commission-reports/flags', { params }).then((r) => r.data?.data ?? []);

export const reviewCommissionFlag = (id, status, note) =>
  client.post(`/commission-reports/flags/${id}/review`, { status, note }).then((r) => r.data);

/**
 * Where a plan applies: a unit, a property, a project, a campaign, or the
 * company as a whole. Separate from versions, because a plan's rules are frozen
 * once active while what it covers is not.
 */
export const assignCommissionPlan = (id, assignment) =>
  client.put(`/commission-plans/${id}/assignment`, assignment).then((r) => r.data);

/** Discard a draft or approved batch, releasing its lines back to the next run. */
export const cancelCommissionPayout = (id) =>
  client.post(`/commission-payouts/${id}/cancel`).then((r) => r.data);
