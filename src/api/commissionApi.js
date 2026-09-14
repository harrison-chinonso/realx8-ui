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
